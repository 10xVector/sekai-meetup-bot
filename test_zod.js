const { z } = require('zod');
const createMomentSchema = z.object({
    title: z.string().min(1).max(200),
    dateTime: z.string().min(1),
    venue: z.string().min(1).max(500),
    description: z.string().min(1).max(2000),
    instructions: z.string().max(2000).optional(),
    externalLinks: z.record(z.string(), z.string()).optional(),
    type: z.enum(['individual', 'group']).default('individual'),
    duration: z.number().int().min(15).max(480).default(60),
    maxGuests: z.number().int().min(1).max(50).default(1),
    preferences: z.array(z.string()).default(['Social']),
    coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
    imageUrl: z.string().url().optional(),
});
const updateMomentSchema = createMomentSchema.partial().extend({
    duration: z.number().int().min(15).max(480).optional(),
});
const payloadWithBug = {
    title: "Code for 24 hours",
    type: "individual",
    dateTime: "2026-03-15T13:00:00.000Z",
    duration: 60,
    maxGuests: undefined,
    preferences: "Social,Tech",
    venue: "123 Main St",
    description: "test",
    instructions: ""
};
const payloadFixed = {
    ...payloadWithBug,
    preferences: ["Social", "Tech"]
};
console.log("Bug result:", updateMomentSchema.safeParse(payloadWithBug).error?.flatten());
console.log("Fixed result:", updateMomentSchema.safeParse(payloadFixed).error?.flatten());
