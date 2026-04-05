import express from "express";
import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";

import { db } from "../db/index.js";
import { departments, subjects } from "../db/schema/index.js";

const router = express.Router();

// Get all departments with optional search and pagination
router.get("/", async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;

        const currentPage = Math.max(1, +page);
        const limitPerPage = Math.max(1, +limit);
        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];

        if (search) {
            filterConditions.push(
                or(
                    ilike(departments.name, `%${search}%`),
                    ilike(departments.code, `%${search}%`)
                )
            );
        }

        const whereClause =
            filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(departments)
            .where(whereClause);

        const totalCount = countResult[0]?.count ?? 0;

        const departmentsList = await db
            .select({
                ...getTableColumns(departments),
                subjectCount: sql<number>`count(${subjects.id})`.as("subject_count"),
            })
            .from(departments)
            .leftJoin(subjects, eq(departments.id, subjects.departmentId))
            .where(whereClause)
            .groupBy(
                departments.id,
                departments.code,
                departments.name,
                departments.description,
                departments.createdAt,
                departments.updatedAt
            )
            .orderBy(desc(departments.createdAt))
            .limit(limitPerPage)
            .offset(offset);

        res.status(200).json({
            data: departmentsList,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            },
        });
    } catch (error) {
        console.error("GET /departments error:", error);
        res.status(500).json({ error: "Failed to fetch departments" });
    }
});

// Get department by id with subject count
router.get("/:id", async (req, res) => {
    try {
        const departmentId = Number(req.params.id);

        if (!Number.isFinite(departmentId)) {
            return res.status(400).json({ error: "Invalid department id" });
        }

        const [department] = await db
            .select({
                ...getTableColumns(departments),
                subjectCount: sql<number>`count(${subjects.id})`.as("subject_count"),
            })
            .from(departments)
            .leftJoin(subjects, eq(departments.id, subjects.departmentId))
            .where(eq(departments.id, departmentId))
            .groupBy(
                departments.id,
                departments.code,
                departments.name,
                departments.description,
                departments.createdAt,
                departments.updatedAt
            );

        if (!department) {
            return res.status(404).json({ error: "Department not found" });
        }

        res.status(200).json({ data: department });
    } catch (error) {
        console.error("GET /departments/:id error:", error);
        res.status(500).json({ error: "Failed to fetch department" });
    }
});

// Create department
router.post("/", async (req, res) => {
    try {
        const { code, name, description } = req.body;

        if (!code || !name) {
            return res.status(400).json({ error: "Code and name are required" });
        }

        const [created] = await db
            .insert(departments)
            .values({ code, name, description })
            .returning();

        res.status(201).json({ data: created });
    } catch (error: any) {
        if (error?.code === "23505") {
            return res.status(409).json({ error: "Department code already exists" });
        }
        console.error("POST /departments error:", error);
        res.status(500).json({ error: "Failed to create department" });
    }
});

// Update department
router.put("/:id", async (req, res) => {
    try {
        const departmentId = Number(req.params.id);

        if (!Number.isFinite(departmentId)) {
            return res.status(400).json({ error: "Invalid department id" });
        }

        const { code, name, description } = req.body;

        const [updated] = await db
            .update(departments)
            .set({ code, name, description })
            .where(eq(departments.id, departmentId))
            .returning();

        if (!updated) {
            return res.status(404).json({ error: "Department not found" });
        }

        res.status(200).json({ data: updated });
    } catch (error: any) {
        if (error?.code === "23505") {
            return res.status(409).json({ error: "Department code already exists" });
        }
        console.error("PUT /departments/:id error:", error);
        res.status(500).json({ error: "Failed to update department" });
    }
});

// Delete department (block if has subjects)
router.delete("/:id", async (req, res) => {
    try {
        const departmentId = Number(req.params.id);

        if (!Number.isFinite(departmentId)) {
            return res.status(400).json({ error: "Invalid department id" });
        }

        // Check for existing subjects
        const [subjectCount] = await db
            .select({ count: sql<number>`count(*)` })
            .from(subjects)
            .where(eq(subjects.departmentId, departmentId));

        if ((subjectCount?.count ?? 0) > 0) {
            return res.status(409).json({
                error: "Cannot delete department with existing subjects. Remove all subjects first.",
            });
        }

        const [deleted] = await db
            .delete(departments)
            .where(eq(departments.id, departmentId))
            .returning({ id: departments.id });

        if (!deleted) {
            return res.status(404).json({ error: "Department not found" });
        }

        res.status(200).json({ data: deleted });
    } catch (error) {
        console.error("DELETE /departments/:id error:", error);
        res.status(500).json({ error: "Failed to delete department" });
    }
});

export default router;
