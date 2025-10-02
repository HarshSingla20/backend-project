import express from "express";
import { registerUser } from "../controllers/user.controller.js"
import { upload } from "../middlewares/multer.middleware.js"

const router = express.Router();

router.post("/register", 
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]), 
    registerUser
);
// router.post("/login", login);
// router.post("/", register);
// router.post("/register", register);

export default router;