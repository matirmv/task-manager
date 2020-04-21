const express = require("express");
const auth = require("../middleware/auth");
const User = require("../models/user");
const multer = require("multer");
const sharp = require("sharp");
const { sendWelcomeEmail, sendCancelationEmail } = require('../emails/account')
const router = new express.Router();

router.post("/users", async(req, res) => {
    const user = new User(req.body);

    try {
        await user.save();
        sendWelcomeEmail(user.email, user.name)
        const token = await user.generateAuthToken();
        res.status(201).send({ user, token });
    } catch (error) {
        res.status(400).send(error);
    }
});

router.post("/users/login", async(req, res) => {
    try {
        const user = await User.findByCredentials(
            req.body.email,
            req.body.password
        );
        const token = await user.generateAuthToken();

        res.send({ user, token });
    } catch (error) {
        console.log(error);

        res.status(400).send(error.message);
    }
});

router.post("/users/logout", auth, async(req, res) => {
    try {
        req.user.tokens = req.user.tokens.filter(
            token => token.token !== req.token
        );
        await req.user.save();

        res.send();
    } catch (error) {
        res.status(500).send();
    }
});

router.post("/users/logoutAll", auth, async(req, res) => {
    try {
        req.user.tokens = [];
        await req.user.save();
        res.send();
    } catch (error) {
        res.status(500).send();
    }
});

router.get("/users/me", auth, async(req, res) => {
    res.send(req.user);
});

router.patch("/users/me", auth, async(req, res) => {
    const updateFields = Object.keys(req.body);
    const acceptedFields = ["name", "age", "email", "password"];
    const validOperation = updateFields.every(field =>
        acceptedFields.includes(field)
    );

    if (!validOperation) {
        return res.status(400).send({ error: "Invalid update !" });
    }

    try {
        updateFields.forEach(field => (req.user[field] = req.body[field]));

        await req.user.save();

        res.send(req.user);
    } catch (e) {
        res.status(400).send(e);
    }
});

router.delete("/users/me", auth, async(req, res) => {
    try {
        await req.user.remove();
        sendCancelationEmail(req.user.email, req.user.name)
        res.send(req.user);
    } catch (error) {
        res.status(400).send(error);
    }
});

const upload = multer({
    limits: {
        fileSize: 1000000
    },
    fileFilter(req, file, cb) {
        if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
            return cb(new Error("Please select an image"));
        }

        cb(null, true);
    }
});

router.post(
    "/users/me/avatar",
    auth,
    upload.single("upload"),
    async(req, res) => {
        const buffer = await sharp(req.file.buffer)
            .resize({ width: 150, height: 150 })
            .png()
            .toBuffer();
        req.user.avatar = buffer;
        await req.user.save();
        res.status(200).send();
    },
    (error, req, res, next) => {
        res.status(400).send({ error: error.message });
    }
);

router.delete("/users/me/avatar", auth, async(req, res) => {
    req.user.avatar = undefined;
    await req.user.save();
    res.status(200).send();
});

router.get("/users/:id/avatar", async(req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user || !user.avatar) {
            throw new Error();
        }

        res.set("Content-Type", "image/png");
        res.send(user.avatar);
    } catch (error) {
        res.status(404).send(error);
    }
});

module.exports = router;