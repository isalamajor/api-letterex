const mongoose = require("mongoose");

// Wait for Mongoose to connect
const connection = async () => {
  try {
    const uri = process.env.MONGODB_ATLAS_URI;
    await mongoose.connect(uri);
    console.log("Connection to database successful");
  } catch (error) {
    console.log(error);
    throw new Error("Unable to connect to database");
  }
};

module.exports = connection;
