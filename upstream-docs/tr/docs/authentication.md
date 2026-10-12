# Authentication
Every request carries a key from your dashboard. The same key works for Alania and Duyu. Browser connections use short-lived tokens instead.
## API keys
Keys start with pd_live_ and go in the Authorization: Bearer header. X-Api-Key is accepted too. Keep keys on the server; never ship them in client code.
Authorization: Bearer pd_live_...
# or
X-Api-Key: pd_live_...
## WebSocket connections
Browser WebSockets can't set headers, so pass the key or token as a ?key= or ?token= query parameter. Use the header when you connect from a server.
## Session tokens
Instead of handing the browser a key, mint a 10-minute JWT on your own server (HS256, signed with the SESSION_JWT_SECRET shared with you). The dashboard playground does exactly this.
Node
import { SignJWT } from "jose";
const secret = new TextEncoder().encode(process.env.SESSION_JWT_SECRET);
const token = await new SignJWT({ scope: "playground" })
.setProtectedHeader({ alg: "HS256" })
.setSubject(userId)
.setIssuedAt()
.setExpirationTime("10m")
.sign(secret);
// browser: new WebSocket("wss://voice.patientdesk.ai/v1/audio/stream?token=" + token)
