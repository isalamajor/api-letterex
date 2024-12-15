const mongoose = require("mongoose");

// Esperar a conectar con mongoose
const connection = async() => {

    try {
        await mongoose.connect("mongodb://localhost:27017/letterex");
        console.log("Connection to database successful");
    } catch(error) {
        console.log(error);
        throw new Error("Unable to connect to database");
    }
}


module.exports = connection ;