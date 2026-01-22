import * as jose from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const secret = new TextEncoder().encode(JWT_SECRET);

export const signToken = async (payload: { userId: string; username: string; role: string }): Promise<string> => {
    const token = await new jose.SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(secret);

    return token;
};

export const verifyToken = async (token: string): Promise<{ userId: string; username: string; role: string }> => {
    const { payload } = await jose.jwtVerify(token, secret);
    return payload as { userId: string; username: string; role: string };
};

