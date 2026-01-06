import { Router } from "express";
import { login, register } from "../controllers/user_controller.js";






const router = Router();
router.route("/login").post(login)
router.route("/register").post(register)
// TODO: Implement these routes
// router.route("/add_to_activity")
// router.route("/get_all_activity")


export default router;