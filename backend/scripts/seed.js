require("dotenv").config();
const mongoose = require("mongoose");
const Enquiry = require("../models/Enquiry");
const Contact = require("../models/Contact");
const Conversation = require("../models/Conversation");

const SAMPLE = [
  { clientName: "Aarav Mehta", phoneNumber: "919812345601", businessName: "Mehta Tailors", websiteType: "Portfolio", status: "new", daysAgo: 0, email: "aarav@mehtatailors.in", pagesCount: "5", domainStatus: "Need new domain", stylePreference: "Minimal", timeline: "2 weeks", existingWebsite: "mehtatailors.in", coreFeature: "Online booking", features: "Gallery, contact form", budget: "₹15,000", targetAudience: "Local customers", tags: ["high-priority"] },
  { clientName: "Priya Sharma", phoneNumber: "919812345602", businessName: "Sharma Sweets", websiteType: "E-commerce", status: "in_progress", daysAgo: 1, email: "priya@sharmasweets.com", pagesCount: "8", domainStatus: "Already has domain", stylePreference: "Warm, vibrant", timeline: "1 month", coreFeature: "Online ordering", features: "Cart, payments, inventory", budget: "₹25,000", targetAudience: "Sweets buyers across India", tags: ["e-com"] },
  { clientName: "Rohit Patel", phoneNumber: "919812345603", businessName: "Patel Auto", websiteType: "Business", status: "completed", daysAgo: 1, email: "rohit@patelauto.co.in", pagesCount: "6", domainStatus: "Already has domain", stylePreference: "Modern, dark", timeline: "3 weeks", coreFeature: "Service booking", features: "Service catalogue, testimonials", budget: "₹18,000", targetAudience: "Car owners in Pune", tags: [] },
  { clientName: "Sneha Verma", phoneNumber: "919812345604", businessName: "Verma Yoga", websiteType: "Landing page", status: "callback_requested", daysAgo: 2, email: "sneha@vermayoga.com", pagesCount: "1", domainStatus: "Need new domain", stylePreference: "Calm, pastel", timeline: "1 week", coreFeature: "Class signup", features: "Instagram feed, signup form", budget: "₹8,000", targetAudience: "Yoga learners", tags: ["urgent"] },
  { clientName: "Karan Singh", phoneNumber: "919812345605", businessName: "Singh Cafe", websiteType: "Business", status: "in_progress", daysAgo: 3, email: "karan@singhcafe.com", pagesCount: "4", domainStatus: "Need new domain", stylePreference: "Cozy, brown tones", timeline: "2 weeks", coreFeature: "Menu page", features: "Photos, hours, map", budget: "₹12,000", targetAudience: "Local cafe visitors", tags: [] },
  { clientName: "Megha Iyer", phoneNumber: "919812345606", businessName: "Iyer Bakery", websiteType: "E-commerce", status: "new", daysAgo: 4, email: null, pagesCount: "10", domainStatus: "Already has domain", stylePreference: "Soft pastels", timeline: "1 month", coreFeature: "Cake ordering", features: "Customization, delivery slots", budget: "₹22,000", targetAudience: "Cake buyers", tags: ["e-com"] },
  { clientName: "Vikram Joshi", phoneNumber: "919812345607", businessName: "Joshi Fitness", websiteType: "Booking", status: "completed", daysAgo: 5, email: "vikram@joshifit.com", pagesCount: "6", domainStatus: "Already has domain", stylePreference: "Bold, athletic", timeline: "3 weeks", coreFeature: "Trainer booking", features: "Booking calendar, plans", budget: "₹20,000", targetAudience: "Gym goers", tags: [] },
  { clientName: "Anita Nair", phoneNumber: "919812345608", businessName: "Nair Travels", websiteType: "Business", status: "new", daysAgo: 6, email: "anita@nairtravels.in", pagesCount: "7", domainStatus: "Need new domain", stylePreference: "Tropical, blue", timeline: "1 month", coreFeature: "Package listings", features: "Enquiry form, gallery", budget: "₹18,000", targetAudience: "Travelers in South India", tags: [] },
  { clientName: "Suresh Kumar", phoneNumber: "919812345609", businessName: "Kumar Electronics", websiteType: "E-commerce", status: "new", daysAgo: 0, email: "suresh@kumarelec.com", pagesCount: "12", domainStatus: "Already has domain", stylePreference: "Tech, sharp", timeline: "6 weeks", coreFeature: "Product catalog", features: "Cart, reviews, search", budget: "₹35,000", targetAudience: "Electronics shoppers", tags: ["high-priority", "e-com"] },
  { clientName: "Divya Rao", phoneNumber: "919812345610", businessName: "Rao Boutique", websiteType: "Portfolio", status: "in_progress", daysAgo: 2, email: "divya@raoboutique.com", pagesCount: "5", domainStatus: "Need new domain", stylePreference: "Elegant, gold", timeline: "2 weeks", coreFeature: "Lookbook", features: "Image gallery, contact form", budget: "₹14,000", targetAudience: "Fashion buyers", tags: [] },
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/whatsapp_loan_automation");
  console.log("connected");

  // Wipe and re-insert via raw collection so we can set custom createdAt
  // (Mongoose's auto-timestamps would otherwise overwrite our backdated values).
  await Enquiry.deleteMany({ phoneNumber: { $in: SAMPLE.map((s) => s.phoneNumber) } });
  await Contact.deleteMany({ phoneNumber: { $in: SAMPLE.map((s) => s.phoneNumber) } });

  const enquiryDocs = SAMPLE.map((s) => {
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - s.daysAgo);
    createdAt.setHours(10 + (s.daysAgo % 8), 30, 0, 0);
    return {
      clientName: s.clientName,
      phoneNumber: s.phoneNumber,
      email: s.email || null,
      businessName: s.businessName,
      websiteType: s.websiteType,
      pagesCount: s.pagesCount || null,
      domainStatus: s.domainStatus || null,
      stylePreference: s.stylePreference || null,
      timeline: s.timeline || null,
      existingWebsite: s.existingWebsite || null,
      targetAudience: s.targetAudience || null,
      coreFeature: s.coreFeature || null,
      features: s.features || null,
      budget: s.budget || null,
      status: s.status,
      tags: s.tags || [],
      callbackRequested: s.status === "callback_requested",
      conversationStage: "review",
      createdAt,
      updatedAt: createdAt,
    };
  });
  await Enquiry.collection.insertMany(enquiryDocs);

  const contactDocs = SAMPLE.map((s, i) => {
    const date = enquiryDocs[i].createdAt;
    return {
      phoneNumber: s.phoneNumber,
      lastContactDate: date,
      totalConversations: 1,
      totalInputTokens: 120 + Math.floor(Math.random() * 200),
      totalOutputTokens: 80 + Math.floor(Math.random() * 250),
      createdAt: date,
      updatedAt: date,
    };
  });
  await Contact.collection.insertMany(contactDocs);

  // Seed conversations with token-bearing messages across the last 7 days
  await Conversation.deleteMany({ phoneNumber: { $in: SAMPLE.map((s) => s.phoneNumber) } });
  const convoDocs = [];
  SAMPLE.forEach((s, idx) => {
    const messages = [];
    let inputTotal = 0;
    let outputTotal = 0;
    // 3 exchanges per contact, spread across the past week
    for (let i = 0; i < 3; i++) {
      const day = (idx + i * 2) % 7;
      const t = new Date();
      t.setDate(t.getDate() - day);
      t.setHours(11 + i * 2, idx % 60, 0, 0);

      const inputTokens = 60 + Math.floor(Math.random() * 80);
      const outputTokens = 40 + Math.floor(Math.random() * 120);
      inputTotal += inputTokens;
      outputTotal += outputTokens;

      messages.push({
        role: "user",
        content: ["Hi", "What about pricing?", "Can you send portfolio?"][i],
        timestamp: t,
        inputTokens: 0,
        outputTokens: 0,
      });
      messages.push({
        role: "assistant",
        content: "Sample assistant reply " + (i + 1),
        timestamp: new Date(t.getTime() + 5000),
        inputTokens,
        outputTokens,
      });
    }
    convoDocs.push({
      phoneNumber: s.phoneNumber,
      messages,
      totalInputTokens: inputTotal,
      totalOutputTokens: outputTotal,
      startedAt: messages[0].timestamp,
      lastMessageAt: messages[messages.length - 1].timestamp,
      createdAt: messages[0].timestamp,
      updatedAt: messages[messages.length - 1].timestamp,
    });
  });
  await Conversation.collection.insertMany(convoDocs);

  // Sync Contact totals so the cost dashboard's lifetime card matches the chart
  for (const cd of convoDocs) {
    await Contact.updateOne(
      { phoneNumber: cd.phoneNumber },
      {
        $set: {
          totalInputTokens: cd.totalInputTokens,
          totalOutputTokens: cd.totalOutputTokens,
          totalConversations: 1,
        },
      }
    );
  }

  const total = await Enquiry.countDocuments();
  const messages = convoDocs.reduce((s, c) => s + c.messages.length, 0);
  console.log(`done — ${total} enquiries, ${convoDocs.length} conversations (${messages} messages) seeded`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
