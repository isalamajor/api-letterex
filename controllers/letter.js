const pruebaLetter = (req, res) => {
    return res.status(200).json({
        message: "Mensaje enviado desde user controller"
    })
}

module.exports = pruebaLetter;