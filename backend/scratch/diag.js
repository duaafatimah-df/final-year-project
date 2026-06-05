const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Post = require('../models/Post');
const User = require('../models/User');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    const posts = await Post.find().populate('receiverId');
    console.log(`Found ${posts.length} posts total in the database.`);

    posts.forEach((post, i) => {
      console.log(`\n--- Post #${i + 1} ---`);
      console.log(`ID: ${post._id}`);
      console.log(`Title: "${post.title}"`);
      console.log(`Description: "${post.description}"`);
      console.log(`Category: "${post.category}"`);
      console.log(`Status: "${post.status}"`);
      if (post.receiverId) {
        console.log(`Receiver ID: ${post.receiverId._id}`);
        console.log(`Receiver Name: "${post.receiverId.name}"`);
        console.log(`Receiver Role: "${post.receiverId.role}"`);
        console.log(`Receiver Approval Status: "${post.receiverId.approvalStatus}"`);
        console.log(`Receiver Location:`, post.receiverId.location);
      } else {
        console.log(`Receiver ID: null (NO POPULATED RECEIVER)`);
      }
    });

    process.exit(0);
  } catch (err) {
    console.error("Error running diagnostics:", err);
    process.exit(1);
  }
}

run();
