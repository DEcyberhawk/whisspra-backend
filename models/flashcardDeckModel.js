
const mongoose = require('mongoose');

const flashcardDeckSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Conversation'
    },
    cards: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Flashcard'
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('FlashcardDeck', flashcardDeckSchema);
