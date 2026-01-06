import httpStatus from "http-status";
import { User } from "../models/user_model.js";
import bcrypt from "bcrypt";
import crypto from "crypto";

const login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "Please provide username and password" });
    }

    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "User not found" });
        }

        // FIXED: Added await to bcrypt.compare
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (isPasswordValid) {
            let token = crypto.randomBytes(20).toString("hex");
            user.token = token;
            await user.save();
            return res.status(httpStatus.OK).json({ token: token });
        } else {
            return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid password" });
        }
    } catch (e) {
        return res.status(500).json({ message: `Something went wrong: ${e.message}` });
    }
}


const register = async (req, res) => {
    const { name, username, password } = req.body;

    // Validation
    if (!name || !username || !password) {
        return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(httpStatus.CONFLICT).json({ message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name: name,
            username: username,
            password: hashedPassword
        });

        await newUser.save();

        res.status(httpStatus.CREATED).json({ message: "User registered successfully" });
    } catch (e) {
        res.status(500).json({ message: `Something went wrong: ${e.message}` });
    }
}

export { login, register };