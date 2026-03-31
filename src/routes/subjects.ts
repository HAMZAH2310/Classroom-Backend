// src/routes/subjects.ts
import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import express from "express";
import { departments, subjects } from "../db/schema/app.js";
import { db } from "../db/db.js";

const router = express.Router();

// Get all subjects with optional search, filtering and pagination
router.get("/", async (req, res) => {
    try {
        const { search, department, page = "1", limit = "10" } = req.query;

        // Pastikan page dan limit adalah angka valid, jika tidak default ke 1 dan 10
        const currentPage = Math.max(1, Number(page) || 1);
        const limitPerPage = Math.max(1, Number(limit) || 10);
        const offset = (currentPage - 1) * limitPerPage;

        const filterCondition = [];

        // Jika search ada, cari berdasarkan nama atau kode subjek
        if (search) {
            const searchTerm = `%${String(search)}%`;
            filterCondition.push(
                or(
                    ilike(subjects.name, searchTerm),
                    ilike(subjects.code, searchTerm)
                )
            );
        }

        // Jika filter department ada, cari berdasarkan nama departemen
        if (department) {
            filterCondition.push(ilike(departments.name, `%${String(department)}%`));
        }

        const whereClause = filterCondition.length > 0 ? and(...filterCondition) : undefined;

        // Get total count for pagination
        const countResult = await db
            .select({ count: sql<string>`count(*)` })
            .from(subjects)
            .innerJoin(departments, eq(subjects.departmentId, departments.id))
            .where(whereClause);

        const totalCount = Number(countResult[0]?.count ?? 0);

        // Get actual data
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

export default router;
