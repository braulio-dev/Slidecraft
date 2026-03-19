import express from 'express';
import Chat from '../models/Chat.mjs';
import { authenticateToken } from '../middleware/auth.mjs';

const router = express.Router();
router.use(authenticateToken);

// POST /api/chats - Create chat
router.post('/', async (req, res) => {
  try {
    const chat = new Chat({ userId: req.user._id, title: req.body.title || 'New Chat' });
    await chat.save();
    res.status(201).json({ chat: { _id: chat._id, title: chat.title, createdAt: chat.createdAt, updatedAt: chat.updatedAt } });
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

// GET /api/chats - List chats (no messages), sorted by most recently updated
router.get('/', async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.user._id })
      .select('-messages')
      .sort({ updatedAt: -1 });
    res.json({ chats });
  } catch (error) {
    console.error('List chats error:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// GET /api/chats/:id - Full chat with messages
router.get('/:id', async (req, res) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, userId: req.user._id });
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    res.json({ chat });
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

// PUT /api/chats/:id/messages - Append a batch of messages
router.put('/:id/messages', async (req, res) => {
  try {
    const { messages } = req.body;
    const chat = await Chat.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $push: { messages: { $each: messages } }, $set: { updatedAt: new Date() } },
      { new: true }
    );
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    res.json({ ok: true });
  } catch (error) {
    console.error('Append messages error:', error);
    res.status(500).json({ error: 'Failed to append messages' });
  }
});

// PATCH /api/chats/:id/title - Rename chat
router.patch('/:id/title', async (req, res) => {
  try {
    const chat = await Chat.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { title: req.body.title } },
      { new: true }
    );
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    res.json({ ok: true });
  } catch (error) {
    console.error('Rename chat error:', error);
    res.status(500).json({ error: 'Failed to rename chat' });
  }
});

// DELETE /api/chats/:id - Delete chat (Conversion records and files untouched)
router.delete('/:id', async (req, res) => {
  try {
    const chat = await Chat.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete chat error:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

export default router;
