
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD
});

const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

app.use("/uploads", express.static(uploadDir));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase();
        const filename =
            Date.now() + "-" + Math.round(Math.random() * 1000000) + extension;

        cb(null, filename);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only JPG, PNG and WebP images are allowed"));
        }
    }
});

app.get("/", (req, res) => {
    res.send("Welcome to NagarMitra API");
});

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "NagarMitra backend is running"
    });
});

// Chennai Corporation ward lookup
app.get("/api/ward", async (req, res) => {
    try {
        const latitude = Number(req.query.latitude);
        const longitude = Number(req.query.longitude);

        if (
            req.query.latitude === undefined ||
            req.query.longitude === undefined ||
            req.query.latitude === "" ||
            req.query.longitude === "" ||
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid latitude and longitude are required"
            });
        }

        const url = new URL(
            "https://gisgcc.chennaicorporation.gov.in/server/rest/services/GCCDepts/EDPMobile2025/FeatureServer/2/query"
        );

        url.search = new URLSearchParams({
            where: "1=1",
            geometry: `${longitude},${latitude}`,
            geometryType: "esriGeometryPoint",
            spatialRel: "esriSpatialRelIntersects",
            inSR: "4326",
            outFields: "*",
            returnGeometry: "false",
            f: "json"
        }).toString();

        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok || data.error) {
            console.error(
                "Chennai ward API error:",
                data.error || response.status
            );

            return res.status(502).json({
                success: false,
                message: "Chennai ward service request failed"
            });
        }

        const features = data.features || [];

        if (features.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No ward found for these coordinates"
            });
        }

        return res.json({
            success: true,
            attributes: features[0].attributes
        });

    } catch (error) {
        console.error("Ward lookup failed:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to identify ward"
        });
    }
});

// Submit complaint with photo
app.post("/api/complaints", upload.single("photo"), async (req, res) => {
    try {
        const { category, description } = req.body;

        const latitude = Number(req.body.latitude);
        const longitude = Number(req.body.longitude);

        if (
            !category ||
            !description ||
            req.body.latitude === undefined ||
            req.body.longitude === undefined ||
            req.body.latitude === "" ||
            req.body.longitude === "" ||
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
        ) {
            if (req.file) {
                fs.unlink(req.file.path, () => {});
            }

            return res.status(400).json({
                success: false,
                message: "Valid category, description and GPS coordinates are required"
            });
        }

        const complaintCode =
            "NM-" + Date.now() + "-" + Math.floor(Math.random() * 1000);

        const photoUrl = req.file
            ? "/uploads/" + req.file.filename
            : null;

        const result = await pool.query(
            `INSERT INTO complaints
            (complaint_code, category, description,
             latitude, longitude, location, photo_url)
            VALUES ($1, $2, $3, $4, $5,
                    ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography,
                    $6)
            RETURNING id, complaint_code, category,
                      description, latitude, longitude,
                      photo_url, status, created_at`,
            [
                complaintCode,
                category,
                description,
                latitude,
                longitude,
                photoUrl
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Complaint submitted successfully",
            complaint: result.rows[0]
        });

    } catch (error) {
        if (req.file) {
            fs.unlink(req.file.path, () => {});
        }

        console.error("Complaint submission failed:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to submit complaint"
        });
    }
});

// Fetch complaints
app.get("/api/complaints", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, complaint_code, category,
                    description, latitude, longitude,
                    photo_url, status, ward_id, created_at
             FROM complaints
             ORDER BY created_at DESC`
        );

        return res.json({
            success: true,
            complaints: result.rows
        });

    } catch (error) {
        console.error("Fetching complaints failed:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch complaints"
        });
    }
});

// Update complaint status
app.patch("/api/complaints/:id/status", async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const allowedStatuses = [
            "SUBMITTED",
            "IN_PROGRESS",
            "RESOLVED"
        ];

        if (!/^[1-9]\d*$/.test(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid complaint ID"
            });
        }

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status"
            });
        }

        const result = await pool.query(
            `UPDATE complaints
             SET status = $1,
                 updated_at = NOW()
             WHERE id = $2
             RETURNING id, complaint_code, status, updated_at`,
            [status, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Complaint not found"
            });
        }

        return res.json({
            success: true,
            message: "Complaint status updated successfully",
            complaint: result.rows[0]
        });

    } catch (error) {
        console.error("Status update failed:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to update complaint status"
        });
    }
});

// Handle upload and server errors
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        return res.status(400).json({
            success: false,
            message: error.code === "LIMIT_FILE_SIZE"
                ? "Photo must be 5 MB or smaller"
                : "Photo upload failed"
        });
    }

    if (error.message === "Only JPG, PNG and WebP images are allowed") {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }

    console.error("Server error:", error.message);

    return res.status(500).json({
        success: false,
        message: "Internal server error"
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`NagarMitra server running on port ${PORT}`);
});
