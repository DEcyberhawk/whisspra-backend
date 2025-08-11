

const { GoogleGenAI, Type } = require('@google/genai');
const Message = require('../models/messageModel');
const Conversation = require('../models/conversationModel');
const User = require('../models/userModel');
const logger = require('../config/logger');

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const formatConversationHistory = (messages) => {
    return messages
        .filter(msg => msg.messageType === 'text' && msg.senderId)
        .map(msg => `${msg.senderId.name}: ${msg.content}`)
        .join('\n');
};

// @desc    Translate text to a target language
// @route   POST /api/ai/translate
// @access  Private
exports.translateText = async (req, res, next) => {
    const { text, targetLanguage } = req.body;
    if (!text || !targetLanguage) {
        res.status(400);
        return next(new Error('Text and target language are required.'));
    }
    try {
        const prompt = `Translate the following text to ${targetLanguage}: "${text}"`;
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        res.status(200).json({ translatedText: response.text });
    } catch (error) {
        next(new Error('Failed to translate text.'));
    }
};

// @desc    Generate smart reply suggestions
// @route   POST /api/ai/suggestions
// @access  Private
exports.generateSuggestions = async (req, res, next) => {
    const { messageText } = req.body;
    if (!messageText) return res.status(400).json({ message: 'messageText is required' });
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Based on the following message, generate exactly 3 short, distinct, and relevant replies. The message is: "${messageText}"`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT, properties: { replies: { type: Type.ARRAY, items: { type: Type.STRING } } }
                },
                temperature: 0.8,
            }
        });
        const parsed = JSON.parse(response.text.trim());
        res.status(200).json(parsed.replies || []);
    } catch (error) {
        next(new Error('Failed to generate AI suggestions.'));
    }
};

// @desc    Generate a summary of messages
// @route   POST /api/ai/summary
// @access  Private
exports.generateSummary = async (req, res, next) => {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ message: 'A message array is required.' });
    try {
        const history = messages
            .filter(msg => msg.type === 'text')
            .map(msg => `User ${msg.senderId.substring(0, 4)}: ${msg.text}`)
            .join('\n');
        
        if (history.length < 20) return res.status(200).json({ summary: "Not enough text to summarize." });

        const prompt = `Please provide a concise summary of the following conversation:\n\n${history}`;
        const response = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
        res.status(200).json({ summary: response.text });
    } catch (error) {
        next(new Error('Failed to generate summary.'));
    }
};

// @desc    Generate vibe-based reply simulations
// @route   POST /api/ai/vibe-replies
// @access  Private
exports.generateVibeReplies = async (req, res, next) => {
    const { conversation, userMessage, currentUser } = req.body;
    try {
        const otherPersonName = conversation.type === 'direct' ? conversation.otherUser.name : 'A group member';
        const history = conversation.messages
            .filter(msg => msg.type === 'text')
            .map(msg => `${msg.senderId === currentUser.id ? currentUser.name : otherPersonName}: ${msg.text}`)
            .slice(-10).join('\n');

        const prompt = `You are a conversation simulator. The user "${currentUser.name}" is thinking of sending the message: "${userMessage}". Based on the following chat history, generate 3 distinct, realistic replies that "${otherPersonName}" might send back. Vary the tone.

Conversation History:
${history}

Return JSON with a "replies" array, where each object has "text" and "tone".`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        replies: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: { text: { type: Type.STRING }, tone: { type: Type.STRING } },
                                required: ['text', 'tone'],
                            }
                        }
                    }
                }
            }
        });
        const parsed = JSON.parse(response.text.trim());
        res.status(200).json(parsed.replies || []);
    } catch (error) {
        next(new Error('Failed to generate vibe replies.'));
    }
};


// @desc    Get an AI-generated summary of a conversation
// @route   POST /api/ai/:conversationId/summary
// @access  Private
exports.getRoomSummary = async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const conversation = await Conversation.findOne({ _id: conversationId, participants: req.user._id });
        if (!conversation || !conversation.isCognitive) {
            res.status(403);
            return next(new Error('Not a cognitive room or you are not a participant.'));
        }

        const messages = await Message.find({ conversationId }).populate('senderId', 'name').sort('createdAt');
        const history = formatConversationHistory(messages);

        if (history.length < 50) {
            return res.status(200).json({ summary: "There isn't enough conversation history to generate a meaningful summary yet." });
        }

        const prompt = `Provide a concise, bulleted summary of the key points and decisions in the following chat conversation:\n\n---\n${history}\n---`;
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        res.status(200).json({ summary: response.text });
    } catch (error) {
        logger.error('Error in getRoomSummary:', error);
        next(new Error('Failed to generate summary from AI.'));
    }
};

// @desc    Ask a question about a conversation's memory
// @route   POST /api/ai/:conversationId/ask
// @access  Private
exports.askRoomMemory = async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const { question } = req.body;

        if (!question) {
            res.status(400);
            return next(new Error('A question is required.'));
        }

        const conversation = await Conversation.findOne({ _id: conversationId, participants: req.user._id });
        if (!conversation || !conversation.isCognitive) {
            res.status(403);
            return next(new Error('Not a cognitive room or you are not a participant.'));
        }

        const messages = await Message.find({ conversationId }).populate('senderId', 'name').sort('createdAt');
        const history = formatConversationHistory(messages);

        const prompt = `Based *only* on the provided conversation history, answer the following question. If the answer is not in the history, say so.\n\nCONVERSATION HISTORY:\n---\n${history}\n---\n\nQUESTION: ${question}`;
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        res.status(200).json({ answer: response.text });
    } catch (error) {
        logger.error('Error in askRoomMemory:', error);
        next(new Error('Failed to get an answer from AI.'));
    }
};

// @desc    Train AI Twin on user's message style
// @route   POST /api/ai/twin/train
// @access  Private
exports.trainAiTwin = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const userMessages = await Message.find({ senderId: req.user._id, messageType: 'text' })
            .sort({ createdAt: -1 })
            .limit(100)
            .select('content');

        if (userMessages.length < 10) {
            return res.status(400).json({ message: 'Not enough message history to train AI Twin. Send at least 10 messages.' });
        }
        
        const messageSamples = userMessages.map(m => m.content).join('\n---\n');
        
        const prompt = `Analyze the following message samples from a user to understand their writing style. Create a concise "style profile" that describes their personality, tone, typical emoji usage, sentence structure, and common phrases. This profile will be used to generate messages in their voice.

Message Samples:
${messageSamples}

Style Profile:`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        user.aiTwinStyleProfile = response.text;
        user.aiTwinLastTrained = new Date();
        await user.save();
        
        logger.info(`AI Twin trained for user ${user._id}`);
        const userObject = user.toObject();
        delete userObject.password;

        res.status(200).json({
            message: 'AI Twin trained successfully!',
            user: userObject,
        });

    } catch (error) {
        logger.error('Error training AI Twin:', error);
        next(new Error('Failed to train AI Twin.'));
    }
};

// @desc    Get a reply suggestion from AI Twin
// @route   POST /api/ai/twin/:conversationId/suggest
// @access  Private
exports.getAiTwinReplySuggestion = async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const user = await User.findById(req.user._id);

        if (!user || !user.aiTwinStyleProfile) {
            return res.status(400).json({ message: 'AI Twin is not trained. Please train it in Settings.' });
        }

        const messages = await Message.find({ conversationId })
            .populate('senderId', 'name')
            .sort({ createdAt: -1 })
            .limit(10)
            .lean(); // Use lean for performance
        
        const history = messages.reverse().map(msg => `${msg.senderId.name}: ${msg.content}`).join('\n');
        
        const prompt = `You are an AI assistant impersonating a user. Your goal is to suggest a reply that perfectly matches the user's writing style.

User's Style Profile:
---
${user.aiTwinStyleProfile}
---

Recent Conversation History (you are "${user.name}"):
---
${history}
---

Based on the style profile and conversation history, generate a single, relevant reply that "${user.name}" would likely send next. Do not add any extra text or quotation marks.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        res.status(200).json({ suggestion: response.text });

    } catch (error) {
        logger.error('Error getting AI Twin suggestion:', error);
        next(new Error('Failed to get suggestion from AI Twin.'));
    }
};

// @desc    Get a prompt for a roleplay room
// @route   POST /api/ai/:conversationId/roleplay-prompt
// @access  Private
exports.getRoleplayPrompt = async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: req.user._id,
            isRoleplayRoom: true
        }).populate('roleplaySettings.characterRoles.userId');

        if (!conversation) {
            res.status(403);
            return next(new Error('Not a roleplay room or you are not a participant.'));
        }

        const userRole = conversation.roleplaySettings.characterRoles.find(r => r.userId._id.toString() === req.user._id.toString());
        if (!userRole) {
            res.status(403);
            return next(new Error('You do not have a role in this room.'));
        }
        
        const messages = await Message.find({ conversationId }).populate('senderId', 'name').sort({ createdAt: -1 }).limit(8);
        const history = formatConversationHistory(messages.reverse());

        const prompt = `You are a roleplay Dungeon Master. The scenario is: "${conversation.roleplaySettings.scenario}".
The user is playing the character "${userRole.characterName}".
Based on the last few lines of the chat, suggest a single, brief, and engaging line of dialogue or an action for "${userRole.characterName}" to say or do next. The suggestion should advance the story.
Do not add quotation marks or any text other than the suggestion itself.

Chat History:
---
${history}
---

Suggestion for ${userRole.characterName}:`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        res.status(200).json({ suggestion: response.text });

    } catch (error) {
        logger.error('Error in getRoleplayPrompt:', error);
        next(new Error('Failed to get roleplay prompt from AI.'));
    }
};

// @desc    Generate an informal agreement from chat history
// @route   POST /api/ai/:conversationId/generate-contract
// @access  Private
exports.generateContract = async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const conversation = await Conversation.findOne({ _id: conversationId, participants: req.user._id })
            .populate('participants', 'name');

        if (!conversation) {
            res.status(404);
            return next(new Error('Conversation not found.'));
        }
        
        if (conversation.isGroup) {
            res.status(400);
            return next(new Error('Contract generation is only available for one-on-one chats.'));
        }

        const messages = await Message.find({ conversationId, messageType: 'text' })
            .populate('senderId', 'name')
            .sort({ createdAt: -1 })
            .limit(50);
        
        const history = messages.reverse().map(msg => `${msg.senderId.name}: ${msg.content}`).join('\n');

        if (history.length < 100) {
            return res.status(400).json({ message: "Not enough conversation history to generate a contract. Discuss the terms first!" });
        }
        
        const parties = conversation.participants.map(p => p.name).join(' and ');
        
        const prompt = `Analyze the following conversation between ${parties}. Extract the key terms of any informal agreement made.
If no clear agreement is present, state that.
Return a JSON object with the parties, a list of agreed-upon terms, and any mentioned effective date.

Conversation:
---
${history}
---
`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        parties: { type: Type.STRING, description: 'The names of the parties involved.' },
                        terms: { type: Type.ARRAY, description: 'A list of the specific points agreed upon.', items: { type: Type.STRING } },
                        effectiveDate: { type: Type.STRING, description: 'The date the agreement starts, if mentioned. Otherwise, "Not specified".' }
                    }
                }
            }
        });
        
        const contractData = JSON.parse(response.text.trim());
        res.status(200).json(contractData);

    } catch (error) {
        logger.error('Error generating contract:', error);
        next(new Error('Failed to generate contract from AI.'));
    }
};

// @desc    Translate text to a different mood/tone
// @route   POST /api/ai/text-mood
// @access  Private
exports.translateTextMessage = async (req, res, next) => {
    try {
        const { text, mood } = req.body;
        if (!text || !mood) {
            res.status(400);
            return next(new Error('Text and target mood are required.'));
        }

        const prompt = `Rewrite the following text to sound "${mood}". Do not add any extra commentary, just provide the rewritten text.\n\nOriginal text: "${text}"`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        res.status(200).json({ translatedText: response.text });

    } catch (error) {
        logger.error('Error in translateTextMessage:', error);
        next(new Error('Failed to translate text mood from AI.'));
    }
};

exports.performSafetyScan = async (message, io) => {
    try {
        let isImage = message.messageType === 'image';
        let isTextWithUrl = message.messageType === 'text' && /https?:\/\//.test(message.content);

        const jsonSchema = {
            type: Type.OBJECT,
            properties: {
                isWarning: { type: Type.BOOLEAN, description: 'True if the content is suspicious, false otherwise.' },
                reason: { type: Type.STRING, description: 'A brief, user-facing explanation for the warning.' },
                type: { type: Type.STRING, enum: ['deepfake', 'scam_link'], description: 'The type of warning.' },
            }
        };

        let scanResult;
        if (isImage) {
            // Image analysis requires a public URL or file bytes, which is complex in this local setup.
            // We will mock the result for demonstration purposes.
            logger.warn(`Mocking safety scan for image message ${message._id} due to local file path.`);
            scanResult = { isWarning: false, reason: 'Image analysis is mocked in local dev.', type: 'deepfake' };
        } else { // Text with URL
            const prompt = `Analyze this text for signs of being a scam (e.g., phishing, fake urgency, suspicious links). Respond with only the specified JSON object.\n\nText: "${message.content}"`;
            const geminiResponse = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: jsonSchema,
                }
            });
            scanResult = JSON.parse(geminiResponse.text.trim());
        }

        const finalAnalysis = {
            status: scanResult.isWarning ? 'warning' : 'safe',
            type: scanResult.isWarning ? scanResult.type : undefined,
            reason: scanResult.isWarning ? scanResult.reason : undefined,
        };
        
        const updatedMessage = await Message.findByIdAndUpdate(
            message._id,
            { $set: { safetyAnalysis: finalAnalysis } },
            { new: true }
        );
        
        io.to(message.conversationId.toString()).emit('messageSafetyUpdate', {
            messageId: updatedMessage._id,
            conversationId: message.conversationId,
            safetyAnalysis: updatedMessage.safetyAnalysis,
        });
        
    } catch (error) {
        logger.error(`Error during safety scan for message ${message._id}:`, error);
        try {
            await Message.findByIdAndUpdate(message._id, { $set: { 'safetyAnalysis.status': 'safe' } });
        } catch (dbError) {
             logger.error(`Failed to mark message as safe after scan error for message ${message._id}:`, dbError);
        }
    }
};

// @desc    Generate AI avatars based on a prompt
// @route   POST /api/ai/generate-avatar
// @access  Private
exports.generateAvatar = async (req, res, next) => {
    try {
        const { prompt } = req.body;
        if (!prompt) {
            res.status(400);
            return next(new Error('A prompt is required to generate an avatar.'));
        }

        const response = await ai.models.generateImages({
            model: 'imagen-3.0-generate-002',
            prompt: `profile avatar, ${prompt}, square, simple background, centered, vector art`,
            config: {
              numberOfImages: 4,
              outputMimeType: 'image/png',
              aspectRatio: '1:1',
            },
        });

        const images = response.generatedImages.map(img => img.image.imageBytes);
        
        res.status(200).json({ images });

    } catch (error) {
        logger.error('Error in generateAvatar:', error);
        next(new Error('Failed to generate avatars from AI.'));
    }
};

// @desc    Transcribe an audio chunk from a voice room or audio bubble
// @route   POST /api/ai/transcribe-audio
// @access  Private
exports.transcribeAudioChunk = async (req, res, next) => {
    try {
        const { conversationId, targetLanguage } = req.body;
        if (!req.file) {
            return res.status(400).json({ message: 'No audio file provided.' });
        }

        const audioBase64 = req.file.buffer.toString('base64');

        const audioPart = {
            inlineData: { mimeType: req.file.mimetype, data: audioBase64 },
        };

        const geminiResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: "Transcribe this short audio clip." }, audioPart] },
        });

        const resultText = geminiResponse.text;
        let translation = null;

        if (targetLanguage && resultText) {
             const translationResponse = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: `Translate the following text to ${targetLanguage}: "${resultText}"`,
            });
            translation = translationResponse.text;
        }
        
        // If it's for a voice room, emit a socket event
        if (conversationId && resultText) {
            const transcription = {
                id: `trans-${Date.now()}`,
                text: resultText,
                translation: translation,
                sender: { id: req.user._id, name: req.user.name }
            };
            req.io.to(conversationId).emit('new-transcription', transcription);
        }

        // Always return the transcription in the response for direct calls (like from AudioBubble)
        res.status(200).json({ success: true, transcription: resultText });

    } catch (error) {
        logger.error('Error in transcribeAudioChunk:', error);
        next(new Error('Failed to transcribe audio.'));
    }
};
