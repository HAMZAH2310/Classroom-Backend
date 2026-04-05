import express from "express";
import { desc, eq, sql } from "drizzle-orm";

import { db } from "../db/index.js";
import { classes, departments, enrollments, subjects, user } from "../db/schema/index.js";

const router = express.Router();

// Overview stats
router.get("/stats", async (req, res) => {
    try {
        const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(user);
        const [classCount] = await db.select({ count: sql<number>`count(*)` }).from(classes);
        const [subjectCount] = await db.select({ count: sql<number>`count(*)` }).from(subjects);
        const [departmentCount] = await db.select({ count: sql<number>`count(*)` }).from(departments);
        const [enrollmentCount] = await db.select({ count: sql<number>`count(*)` }).from(enrollments);

        const [activeClassCount] = await db
            .select({ count: sql<number>`count(*)` })
            .from(classes)
            .where(eq(classes.status, "active"));

        res.status(200).json({
            data: {
                totalUsers: userCount?.count ?? 0,
                totalClasses: classCount?.count ?? 0,
                activeClasses: activeClassCount?.count ?? 0,
                totalSubjects: subjectCount?.count ?? 0,
                totalDepartments: departmentCount?.count ?? 0,
                totalEnrollments: enrollmentCount?.count ?? 0,
            },
        });
    } catch (error) {
        console.error("GET /dashboard/stats error:", error);
        res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
});

// Enrollment trends (last 12 months)
router.get("/charts/enrollment-trends", async (req, res) => {
    try {
        const trends = await db
            .select({
                month: sql<string>`to_char(${enrollments.createdAt}, 'YYYY-MM')`.as("month"),
                count: sql<number>`count(*)`.as("count"),
            })
            .from(enrollments)
            .where(
                sql`${enrollments.createdAt} >= now() - interval '12 months'`
            )
            .groupBy(sql`to_char(${enrollments.createdAt}, 'YYYY-MM')`)
            .orderBy(sql`to_char(${enrollments.createdAt}, 'YYYY-MM')`);

        res.status(200).json({ data: trends });
    } catch (error) {
        console.error("GET /dashboard/charts/enrollment-trends error:", error);
        res.status(500).json({ error: "Failed to fetch enrollment trends" });
    }
});

// Classes by department
router.get("/charts/classes-by-department", async (req, res) => {
    try {
        const result = await db
            .select({
                department: departments.name,
                count: sql<number>`count(${classes.id})`.as("count"),
            })
            .from(departments)
            .leftJoin(subjects, eq(subjects.departmentId, departments.id))
            .leftJoin(classes, eq(classes.subjectId, subjects.id))
            .groupBy(departments.id, departments.name)
            .orderBy(sql`count(${classes.id}) desc`);

        res.status(200).json({ data: result });
    } catch (error) {
        console.error("GET /dashboard/charts/classes-by-department error:", error);
        res.status(500).json({ error: "Failed to fetch classes by department" });
    }
});

// Capacity status
router.get("/charts/capacity-status", async (req, res) => {
    try {
        const classesWithEnrollment = await db
            .select({
                id: classes.id,
                capacity: classes.capacity,
                enrolled: sql<number>`count(${enrollments.id})`.as("enrolled"),
            })
            .from(classes)
            .leftJoin(enrollments, eq(enrollments.classId, classes.id))
            .groupBy(classes.id, classes.capacity);

        let low = 0, medium = 0, high = 0, full = 0;

        for (const c of classesWithEnrollment) {
            const ratio = c.capacity > 0 ? (c.enrolled / c.capacity) : 0;
            if (ratio >= 1) full++;
            else if (ratio >= 0.75) high++;
            else if (ratio >= 0.4) medium++;
            else low++;
        }

        res.status(200).json({
            data: [
                { status: "Low (<40%)", count: low },
                { status: "Medium (40-75%)", count: medium },
                { status: "High (75-99%)", count: high },
                { status: "Full (100%)", count: full },
            ],
        });
    } catch (error) {
        console.error("GET /dashboard/charts/capacity-status error:", error);
        res.status(500).json({ error: "Failed to fetch capacity status" });
    }
});

// User distribution by role
router.get("/charts/user-distribution", async (req, res) => {
    try {
        const result = await db
            .select({
                role: user.role,
                count: sql<number>`count(*)`.as("count"),
            })
            .from(user)
            .groupBy(user.role);

        res.status(200).json({ data: result });
    } catch (error) {
        console.error("GET /dashboard/charts/user-distribution error:", error);
        res.status(500).json({ error: "Failed to fetch user distribution" });
    }
});

// Recent activity
router.get("/activity", async (req, res) => {
    try {
        const recentEnrollments = await db
            .select({
                id: enrollments.id,
                type: sql<string>`'enrollment'`.as("type"),
                studentName: user.name,
                className: classes.name,
                createdAt: enrollments.createdAt,
            })
            .from(enrollments)
            .leftJoin(user, eq(enrollments.studentId, user.id))
            .leftJoin(classes, eq(enrollments.classId, classes.id))
            .orderBy(desc(enrollments.createdAt))
            .limit(10);

        const recentClasses = await db
            .select({
                id: classes.id,
                type: sql<string>`'class_created'`.as("type"),
                className: classes.name,
                teacherName: user.name,
                createdAt: classes.createdAt,
            })
            .from(classes)
            .leftJoin(user, eq(classes.teacherId, user.id))
            .orderBy(desc(classes.createdAt))
            .limit(10);

        // Merge and sort by date
        const allActivity = [
            ...recentEnrollments.map((e) => ({
                id: `enrollment-${e.id}`,
                type: "enrollment" as const,
                description: `${e.studentName} enrolled in ${e.className}`,
                createdAt: e.createdAt,
            })),
            ...recentClasses.map((c) => ({
                id: `class-${c.id}`,
                type: "class_created" as const,
                description: `${c.teacherName} created class "${c.className}"`,
                createdAt: c.createdAt,
            })),
        ].sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
        }).slice(0, 15);

        res.status(200).json({ data: allActivity });
    } catch (error) {
        console.error("GET /dashboard/activity error:", error);
        res.status(500).json({ error: "Failed to fetch activity" });
    }
});

export default router;
