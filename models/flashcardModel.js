
const mongoose = require('mongoose');

const flashcardSchema = new mongoose.Schema({
    deck: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'FlashcardDeck'
    },
    front: {
        type: String,
        required: true,
    },
    back: {
        type: String,
        required: true,
    },
}, {
    timestamps: true
});

module.exports = mongoose.model('Flashcard', flashcardSchema);
