/** @jsx h */
import { createContext, h } from "preact";
import { useContext, useReducer, useState } from "preact/hooks";
import { DBSchema, openDB } from "idb";
import { tw } from "@twind";

export default function AudioSampler({ dbName, version }: AudioSamplerProps) {
    const AudioSamplerContext = setupAudioSamplerContext({ dbName, version });

    return (
        <AudioSamplerContext>
            <TestButton />
        </AudioSamplerContext>
    );
}

function useTestButton() {
    const { dispatch, state: { dbName, version } } = useAudioSamplerContext();
    const [name, setName] = useState("todo");

    const connectDB = async () => {
        const db = await dbConnection({ dbName, version });

        // const tx = db.transaction("sample", "readwrite");

        // await tx.done;

        console.log(`connecting to v${version} of ${dbName}`, db);
    };

    function uploadSample(e: DragEvent) {
        e.preventDefault();

        // only one file at a time
        const file = e.dataTransfer?.files.item(0);

        if (file) {
            // remove extension from filename and set to name
            const name = file?.name.replace(/\.[^/.]+$/, "");
            setName(name);
        }
    }

    return { connectDB, uploadSample, name };
}

function TestButton() {
    const { connectDB, uploadSample, name } = useTestButton();

    return (
        <button
            class={tw`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded`}
            onPointerDown={connectDB}
            onDrop={uploadSample}
            onDragOver={(e) => e.preventDefault()}
        >
            {name}
        </button>
    );
}

/** IndexedDB */

type AudioSamplerSchema = DBSchema & {
    sample: {
        key: string;
        value: SampleEntry;
    };
    user: {
        key: string;
        value: UserEntry;
    };
};

type SampleEntry = {
    id: number;
    name: string;
    file: File;
};

type UserEntry = {
    id: number;
    name: string;
};

function dbConnection({ dbName, version }: { dbName: string, version: number; }) {
    return openDB<AudioSamplerSchema>(dbName, version, {
        upgrade: (db, prev, curr, tx) => {
            console.log(`${db} upgraded from v${prev} to v${curr}`);

            if (db.objectStoreNames.contains("sample"))
                db.deleteObjectStore("sample");

            if (db.objectStoreNames.contains("user"))
                db.deleteObjectStore("user");

            db.createObjectStore("sample", { keyPath: "id", autoIncrement: true });
            db.createObjectStore("user", { keyPath: "id", autoIncrement: true });
        }
    });
}

/** Audio Sampler */

type AudioSamplerProps = { dbName: string, version: number; };

type AudioSamplerAction = | { type: "test"; payload: AudioSamplerState; };

type AudioSamplerDispatch = (action: AudioSamplerAction) => void;

type AudioSamplerState = {
    dbName: string;
    version: number;
};

const AudioSamplerDispatchContext = createContext<AudioSamplerDispatch>(() => { });

const AudioSamplerStateContext = createContext<AudioSamplerState | undefined>(undefined);

function useAudioSamplerContext() {
    const dispatch = useContext(AudioSamplerDispatchContext);
    const state = useContext(AudioSamplerStateContext);
    if (!state)
        throw new Error("useAudioSamplerContext must be used within a AudioSamplerContext");

    return { dispatch, state };
}

function setupAudioSamplerContext({ dbName, version }: { dbName: string, version: number; }) {
    // const db = connectDB({ dbName, version });

    const [state, dispatch] = useReducer<AudioSamplerState, AudioSamplerAction>((state, action) => {
        switch (action.type) {
            case "test":
                console.log("test");
                return state;
            default:
                return state;
        }
    }, { dbName, version });

    return function ({ children }: { children: h.JSX.Element; }) {
        return (
            <AudioSamplerStateContext.Provider value={state}>
                <AudioSamplerDispatchContext.Provider value={dispatch}>
                    {children}
                </AudioSamplerDispatchContext.Provider >
            </AudioSamplerStateContext.Provider>
        );
    };
}