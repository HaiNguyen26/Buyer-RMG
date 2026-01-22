import argon2 from 'argon2';

export const hashPassword = async (password: string): Promise<string> => {
    return argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536, // 64 MB
        timeCost: 3, // 3 iterations
        parallelism: 4,
    });
};

export const verifyPassword = async (
    hashedPassword: string,
    password: string
): Promise<boolean> => {
    try {
        return await argon2.verify(hashedPassword, password);
    } catch (error) {
        return false;
    }
};

