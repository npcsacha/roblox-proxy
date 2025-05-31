const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/followers-count', async (req, res) => {
    const userId = req.query.userid;
    if (!userId) {
        return res.status(400).json({ error: "UserId is required" });
    }

    try {
        const followersRes = await axios.get(`https://friends.roblox.com/v1/users/${userId}/followers/count`);
        const followersCount = followersRes.data.count;

        const userRes = await axios.get(`https://users.roblox.com/v1/users/${userId}`);
        const isVerified = userRes.data.hasVerifiedBadge;

        res.json({
            followersCount: followersCount,
            isVerified: isVerified
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch data from Roblox API" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Proxy server running on port ${PORT}`);
});
