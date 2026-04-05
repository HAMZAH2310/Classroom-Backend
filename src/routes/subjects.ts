import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import express from "express";
import { departments, subjects, classes } from "../db/schema/index.js";
import { db } from "../db/index.js";

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const { search, department, page = "1", limit = "10" } = req.query;

        const currentPage = Math.max(1, Number(page) || 1);
        const limitPerPage = Math.max(1, Number(limit) || 10);
        const offset = (currentPage - 1) * limitPerPage;

        const filterCondition = [];

        function escapeLikePattern(str: string): string {
            return str.replace(/[\\%_]/g, '\\$&');
        }

        if (search) {
            const searchTerm = `%${escapeLikePattern(String(search))}%`;
            filterCondition.push(
                or(
                    ilike(subjects.name, searchTerm),
                    ilike(subjects.code, searchTerm)
                )
            );
        }

        if (department) {
            filterCondition.push(ilike(departments.name, `%${escapeLikePattern(String(department))}%`));
        }

        const whereClause = filterCondition.length > 0 ? and(...filterCondition) : undefined;

        const countResult = await db
            .select({ count: sql<string>`count(*)` })
            .from(subjects)
            .innerJoin(departments, eq(subjects.departmentId, departments.id))
            .where(whereClause);

        const totalCount = Number(countResult[0]?.count ?? 0);

        const subjectList = await db
            .select({
                ...getTableColumns(subjects),
                department: getTableColumns(departments)
            })
            .from(subjects)
            .innerJoin(departments, eq(subjects.departmentId, departments.id))
            .where(whereClause)
            .orderBy(desc(subjects.createdAt))
            .limit(limitPerPage)
            .offset(offset);

        res.status(200).json({
            data: subjectList,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            }
        });

    } catch (e) {
        console.error(`GET /subjects error: ${e}`);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Get subject by id
router.get("/:id", async (req, res) => {
    try {
        const subjectId = Number(req.params.id);

        if (!Number.isFinite(subjectId)) {
            return res.status(400).json({ error: "Invalid subject id" });
        }

        const [subject] = await db
            .select({
                ...getTableColumns(subjects),
                department: getTableColumns(departments),
                classCount: sql<number>`count(${classes.id})`.as("class_count"),
            })
            .from(subjects)
            .innerJoin(departments, eq(subjects.departmentId, departments.id))
            .leftJoin(classes, eq(classes.subjectId, subjects.id))
            .where(eq(subjects.id, subjectId))
            .groupBy(
                subjects.id,
                subjects.departmentId,
                subjects.code,
                subjects.name,
                subjects.description,
                subjects.createdAt,
                subjects.updatedAt,
                departments.id,
                departments.code,
                departments.name,
                departments.description,
                departments.createdAt,
                departments.updatedAt
            );

        if (!subject) {
            return res.status(404).json({ error: "Subject not found" });
        }

        res.status(200).json({ data: subject });
    } catch (error) {
        console.error("GET /subjects/:id error:", error);
        res.status(500).json({ error: "Failed to fetch subject" });
    }
});

// Create subject
router.post("/", async (req, res) => {
    try {
        const { code, name, description, departmentId } = req.body;

        if (!code || !name || !departmentId) {
            return res.status(400).json({ error: "Code, name, and departmentId are required" });
        }

        const [created] = await db
            .insert(subjects)
            .values({ code, name, description, departmentId: Number(departmentId) })
            .returning();

        res.status(201).json({ data: created });
    } catch (error: any) {
        if (error?.code === "23505") {
            return res.status(409).json({ error: "Subject code already exists" });
        }
        console.error("POST /subjects error:", error);
        res.status(500).json({ error: "Failed to create subject" });
    }
});

// Update subject
router.put("/:id", async (req, res) => {
    try {
        const subjectId = Number(req.params.id);

        if (!Number.isFinite(subjectId)) {
            return res.status(400).json({ error: "Invalid subject id" });
        }

        const { code, name, description, departmentId } = req.body;

        const [updated] = await db
            .update(subjects)
            .set({
                code,
                name,
                description,
                departmentId: departmentId ? Number(departmentId) : undefined,
            })
            .where(eq(subjects.id, subjectId))
            .returning();

        if (!updated) {
            return res.status(404).json({ error: "Subject not found" });
        }

        res.status(200).json({ data: updated });
    } catch (error: any) {
        if (error?.code === "23505") {
            return res.status(409).json({ error: "Subject code already exists" });
        }
        console.error("PUT /subjects/:id error:", error);
        res.status(500).json({ error: "Failed to update subject" });
    }
});

// Delete subject (block if has classes)
router.delete("/:id", async (req, res) => {
    try {
        const subjectId = Number(req.params.id);

        if (!Number.isFinite(subjectId)) {
            return res.status(400).json({ error: "Invalid subject id" });
        }

        const [classCount] = await db
            .select({ count: sql<number>`count(*)` })
            .from(classes)
            .where(eq(classes.subjectId, subjectId));

        if ((classCount?.count ?? 0) > 0) {
            return res.status(409).json({
                error: "Cannot delete subject with existing classes. Remove all classes first.",
            });
        }

        const [deleted] = await db
            .delete(subjects)
            .where(eq(subjects.id, subjectId))
            .returning({ id: subjects.id });

        if (!deleted) {
            return res.status(404).json({ error: "Subject not found" });
        }

        res.status(200).json({ data: deleted });
    } catch (error) {
        console.error("DELETE /subjects/:id error:", error);
        res.status(500).json({ error: "Failed to delete subject" });
    }
});

export default router;
