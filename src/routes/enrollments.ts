import express from "express";
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "../db/index.js";
import { classes, enrollments } from "../db/schema/index.js";

const router = express.Router();

// Get all enrollments with optional filters and pagination
router.get("/", async (req, res) => {
    try {
        const { classId, studentId, page = 1, limit = 10 } = req.query;

        const currentPage = Math.max(1, +page);
        const limitPerPage = Math.max(1, +limit);
        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];

        if (classId) {
            filterConditions.push(eq(enrollments.classId, Number(classId)));
        }

        if (studentId) {
            filterConditions.push(eq(enrollments.studentId, String(studentId)));
        }

        const whereClause =
            filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(enrollments)
            .where(whereClause);

        const totalCount = countResult[0]?.count ?? 0;

        const enrollmentsList = await db
            .select()
            .from(enrollments)
            .where(whereClause)
            .orderBy(desc(enrollments.createdAt))
            .limit(limitPerPage)
            .offset(offset);

        res.status(200).json({
            data: enrollmentsList,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            },
        });
    } catch (error) {
        console.error("GET /enrollments error:", error);
        res.status(500).json({ error: "Failed to fetch enrollments" });
    }
});

// Create enrollment (validate capacity and uniqueness)
router.post("/", async (req, res) => {
    try {
        const { classId, studentId } = req.body;

        if (!classId || !studentId) {
            return res.status(400).json({ error: "classId and studentId are required" });
        }

        // Check class exists and get capacity
        const [classRecord] = await db
            .select({ id: classes.id, capacity: classes.capacity })
            .from(classes)
            .where(eq(classes.id, Number(classId)));

        if (!classRecord) {
            return res.status(404).json({ error: "Class not found" });
        }

        // Check current enrollment count
        const [enrollmentCount] = await db
            .select({ count: sql<number>`count(*)` })
            .from(enrollments)
            .where(eq(enrollments.classId, Number(classId)));

        if ((enrollmentCount?.count ?? 0) >= classRecord.capacity) {
            return res.status(409).json({ error: "Class is at full capacity" });
        }

        const [created] = await db
            .insert(enrollments)
            .values({
                classId: Number(classId),
                studentId: String(studentId),
            })
            .returning();

        res.status(201).json({ data: created });
    } catch (error: any) {
        if (error?.code === "23505") {
            return res.status(409).json({ error: "Student is already enrolled in this class" });
        }
        console.error("POST /enrollments error:", error);
        res.status(500).json({ error: "Failed to create enrollment" });
    }
});

// Delete enrollment
router.delete("/:id", async (req, res) => {
    try {
        const enrollmentId = Number(req.params.id);

        if (!Number.isFinite(enrollmentId)) {
            return res.status(400).json({ error: "Invalid enrollment id" });
        }

        const [deleted] = await db
            .delete(enrollments)
            .where(eq(enrollments.id, enrollmentId))
            .returning({ id: enrollments.id });

        if (!deleted) {
            return res.status(404).json({ error: "Enrollment not found" });
        }

        res.status(200).json({ data: deleted });
    } catch (error) {
        console.error("DELETE /enrollments/:id error:", error);
        res.status(500).json({ error: "Failed to delete enrollment" });
    }
});

export default router;
