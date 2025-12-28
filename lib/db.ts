export interface SavedResume {
    id: string;
    userId: string;
    name: string;
    file: File;
    timestamp: number;
}

const DB_NAME = "AutoResumeDB";
const STORE_NAME = "resumes";
const DB_VERSION = 1;

export const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
        };
    });
};

export const saveResumeToDB = async (file: File, userId: string): Promise<SavedResume> => {
    const db = await initDB();
    const id = crypto.randomUUID();
    const resume: SavedResume = {
        id,
        userId,
        name: file.name,
        file,
        timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(resume);

        request.onsuccess = () => resolve(resume);
        request.onerror = () => reject(request.error);
    });
};

export const getResumesFromDB = async (userId: string): Promise<SavedResume[]> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            // Filter by userId and sort by newest first
            const allResumes = request.result as SavedResume[];
            const userResumes = allResumes.filter(r => r.userId === userId);
            resolve(userResumes.sort((a, b) => b.timestamp - a.timestamp));
        };
        request.onerror = () => reject(request.error);
    });
};

export const deleteResumeFromDB = async (id: string): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};
