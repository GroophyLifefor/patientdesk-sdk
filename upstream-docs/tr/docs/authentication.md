# Kimlik doğrulama
Her istek panelden aldığınız anahtarı taşır. Aynı anahtar Alania’da ve Duyu’da geçerlidir. Tarayıcıdan açılan bağlantılar için kısa ömürlü tokenlar vardır.
## API anahtarları
Anahtarlar pd_live_ ile başlar ve Authorization: Bearer başlığında gönderilir. X-Api-Key başlığı da kabul edilir. Anahtarı sunucu tarafında tutun; istemci koduna asla gömmeyin.
Authorization: Bearer pd_live_...
# or
X-Api-Key: pd_live_...
## WebSocket bağlantıları
Tarayıcıdaki WebSocket başlık gönderemez; anahtar ya da token ?key= veya ?token= sorgu parametresiyle verilir. Sunucudan bağlanırken başlığı kullanın.
## Oturum tokenları
Tarayıcıya anahtar vermek yerine kendi sunucunuzda 10 dakikalık bir JWT üretin (HS256, sizinle paylaşılan SESSION_JWT_SECRET ile imzalanır). Paneldeki deneme alanı tam olarak bunu yapar.
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
