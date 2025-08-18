class IndexController {
    getIndex(req, res) {
        res.send('Welcome to the Express Server!');
    }
}

module.exports = IndexController;