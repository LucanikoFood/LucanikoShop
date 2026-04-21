import Event from '../models/Event.js';
import cloudinary from '../config/cloudinary.js';

// @desc    Get all active events (public)
// @route   GET /api/events
// @access  Public
export const getEvents = async (req, res) => {
  try {
    const events = await Event.find({ status: 'active' })
      .lean(); // ⚡ Converti a plain object per performance
    // Sort by first date in eventDates array
    events.sort((a, b) => {
      const dateA = a.eventDates && a.eventDates.length > 0 ? new Date(a.eventDates[0]) : new Date(0);
      const dateB = b.eventDates && b.eventDates.length > 0 ? new Date(b.eventDates[0]) : new Date(0);
      return dateA - dateB;
    });
    res.json(events);
  } catch (error) {
    console.error('Errore recupero eventi:', error);
    res.status(500).json({ message: 'Errore recupero eventi' });
  }
};

// @desc    Get all events (admin)
// @route   GET /api/events/admin/all
// @access  Private/Admin
export const getAllEvents = async (req, res) => {
  try {
    const events = await Event.find()
      .lean(); // ⚡ Converti a plain object per performance
    // Sort by first date in eventDates array
    events.sort((a, b) => {
      const dateA = a.eventDates && a.eventDates.length > 0 ? new Date(a.eventDates[0]) : new Date(0);
      const dateB = b.eventDates && b.eventDates.length > 0 ? new Date(b.eventDates[0]) : new Date(0);
      return dateA - dateB;
    });
    res.json(events);
  } catch (error) {
    console.error('Errore recupero eventi (admin):', error);
    res.status(500).json({ message: 'Errore recupero eventi' });
  }
};

// @desc    Get single event
// @route   GET /api/events/:id
// @access  Public
export const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Evento non trovato' });
    }
    res.json(event);
  } catch (error) {
    console.error('Errore recupero evento:', error);
    res.status(500).json({ message: 'Errore recupero evento' });
  }
};

// @desc    Create new event
// @route   POST /api/events
// @access  Private/Admin
export const createEvent = async (req, res) => {
  try {
    const { title, description, company, city, address, phone, website, categories, eventDates, eventTime, images, status } = req.body;

    // Validazione campi obbligatori
    if (!title || !description || !company || !city || !categories || !Array.isArray(categories) || categories.length === 0 || !eventDates || !Array.isArray(eventDates) || eventDates.length === 0) {
      return res.status(400).json({ message: 'Campi obbligatori mancanti, categories o eventDates non validi' });
    }

    const event = new Event({
      title,
      description,
      company,
      city,
      address,
      phone,
      website,
      categories,
      eventDates,
      eventTime,
      images: images || [],
      status: status || 'active'
    });

    const createdEvent = await event.save();
    res.status(201).json(createdEvent);
  } catch (error) {
    console.error('Errore creazione evento:', error);
    res.status(500).json({ message: 'Errore creazione evento' });
  }
};

// @desc    Update event
// @route   PUT /api/events/:id
// @access  Private/Admin
export const updateEvent = async (req, res) => {
  try {
    const { title, description, company, city, address, phone, website, categories, eventDates, eventTime, images, status } = req.body;

    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Evento non trovato' });
    }

    event.title = title || event.title;
    event.description = description || event.description;
    event.company = company || event.company;
    event.city = city || event.city;
    event.address = address !== undefined ? address : event.address;
    event.phone = phone || event.phone;
    event.website = website !== undefined ? website : event.website;
    event.categories = categories || event.categories;
    event.eventDates = eventDates || event.eventDates;
    event.eventTime = eventTime !== undefined ? eventTime : event.eventTime;
    event.images = images !== undefined ? images : event.images;
    event.status = status || event.status;

    const updatedEvent = await event.save();
    res.json(updatedEvent);
  } catch (error) {
    console.error('Errore aggiornamento evento:', error);
    res.status(500).json({ message: 'Errore aggiornamento evento' });
  }
};

// @desc    Delete event
// @route   DELETE /api/events/:id
// @access  Private/Admin
export const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Evento non trovato' });
    }

    // Elimina immagini da Cloudinary
    for (const image of event.images) {
      if (image.public_id) {
        try {
          await cloudinary.uploader.destroy(image.public_id);
        } catch (err) {
          console.error('Errore eliminazione immagine Cloudinary:', err);
        }
      }
    }

    await Event.findByIdAndDelete(req.params.id);
    res.json({ message: 'Evento eliminato' });
  } catch (error) {
    console.error('Errore eliminazione evento:', error);
    res.status(500).json({ message: 'Errore eliminazione evento' });
  }
};
