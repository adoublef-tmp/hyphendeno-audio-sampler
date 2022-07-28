/** @jsx h */
import { createContext, h } from "preact";
import { useContext, useEffect, useReducer, useState } from "preact/hooks";
import { openDB, DBSchema } from "idb/with-async-ittr";
import { tw } from "@twind";
import { IS_BROWSER } from "https://deno.land/x/fresh@1.0.1/runtime.ts";

export default function AudioSampler({ dbName, version }: AudioSamplerProps) {
    const AudioSamplerContext = setupAudioSamplerContext({ dbName, version });

    return (
        <AudioSamplerContext>
            <div>
                <SampleLibrary />
                <SamplePad />
            </div>
        </AudioSamplerContext>
    );
}

function useSampleLibrary() {
    const { dispatch, state: { dbName, version } } = useAudioSamplerContext();
    const [library, setLibrary] = useState<string[]>([]);

    useEffect(() => {
        if (IS_BROWSER) {
            (async () => {
                const db = await dbConnection({ dbName, version });

                const tx = db.transaction("sample");

                for await (const cursor of tx.store) {
                    console.log(cursor.key, cursor.value);
                }
            })();
        }
    }, [IS_BROWSER]);

    return { library };
}

function SampleLibrary() {
    const { library } = useSampleLibrary();

    return (
        <div>
            <h1>Sample Library</h1>
            <SamplePreview />
        </div>
    );
}

function SamplePreview() {
    return (
        <div class={tw`border(2 red solid) w-20`}>This is a sample preview</div>
    );
}

function useSamplePad() {
    const { dispatch, state: { dbName, version, audioCtx } } = useAudioSamplerContext();

    const [name, setName] = useState("todo");

    const playSample = async () => {
        /** GET FROM DATABASE */
        const db = await dbConnection({ dbName, version });

        const tx = db.transaction("sample", "readwrite");
        const store = tx.objectStore("sample");

        const [sample] = await Promise.all([store.get(name), tx.done]);

        /** PLAY AUDIO SAMPLE */
        if (audioCtx && sample) {
            const { file } = sample;

            const buf = await file.arrayBuffer();
            const src = new AudioBufferSourceNode(audioCtx, { buffer: await audioCtx.decodeAudioData(buf) });

            src.connect(src.context.destination);
            src.start();
        }
    };

    async function uploadSample(e: DragEvent) {
        e.preventDefault();

        // only one file at a time
        const file = e.dataTransfer?.files.item(0);

        if (audioCtx && file) {
            /** ADD TO DATABASE - `put` replace (&&) `add` rejects */
            const db = await dbConnection({ dbName, version });

            const tx = db.transaction("sample", "readwrite");
            const store = tx.objectStore("sample");

            const sample = { name: file.name.replace(/\.[^/.]+$/, ""), size: file.size, file: file };

            const [name, , buf] = await Promise.all([store.put(sample), tx.done, file.arrayBuffer()]);

            /** PLAY AUDIO SAMPLE */
            const src = new AudioBufferSourceNode(audioCtx, { buffer: await audioCtx.decodeAudioData(buf) });

            src.connect(src.context.destination);
            src.start();

            setName(name);
        }

        // dispatch({ type: "uploadsample", payload: file });
    }

    return { playSample, uploadSample, sampleName: name };
}

function SamplePad() {
    const { playSample, uploadSample, sampleName } = useSamplePad();

    return (
        <button
            class={tw`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded`}
            onPointerDown={playSample}
            onDrop={uploadSample}
            onDragOver={(e) => e.preventDefault()}
        >
            {sampleName}
        </button>
    );
}

/** IndexedDB */

type AudioSamplerSchema = DBSchema & {
    sample: SampleTable;
};

type SampleIndex = { "by-size": number; };

type SampleTable = {
    key: string;
    value: SampleEntry;
    indexes: SampleIndex;
};

type SampleEntry = {
    name: string;
    file: File;
    size: number;
};

function dbConnection({ dbName, version }: { dbName: string, version: number; }) {
    return openDB<AudioSamplerSchema>(dbName, version, {
        upgrade: (db, prev, curr, tx) => {
            console.log(`${db} upgraded from v${prev} to v${curr}`);

            if (db.objectStoreNames.contains("sample"))
                db.deleteObjectStore("sample");

            const store = db.createObjectStore("sample", { keyPath: "name" });
            store.createIndex("by-size", "size");
        }
    });
}

/** Audio Sampler */

type AudioSamplerProps = { dbName: string, version: number; };

type AudioSamplerAction =
    | { type: "test"; payload: AudioSamplerState; }
    | { type: "audiocontext", payload: AudioContext; };

type AudioSamplerDispatch = (action: AudioSamplerAction) => void;

type AudioSamplerState = {
    dbName: string;
    version: number;
    audioCtx?: AudioContext;
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
    /** 
     * FIXME - when `useReducer` is inside the the HOF I get the following error: 
     * main.js:1 Uncaught (in promise) DOMException: 
     * Failed to execute 'insertBefore' on 'Node': 
     * The node before which the new node is to be inserted is not a child of this node.
     */

    return function ({ children }: { children: h.JSX.Element; }) {
        const [state, dispatch] = useReducer<AudioSamplerState, AudioSamplerAction>((state, action) => {
            switch (action.type) {
                case "audiocontext":
                    return { ...state, audioCtx: action.payload };
                case "test":
                    console.log("this is a test");
                    return state;
                default:
                    return state;
            }
        }, { dbName, version });

        useEffect(() => {
            IS_BROWSER && // alert("AudioSampler is running in the browser");
                dispatch({ type: "audiocontext", payload: new AudioContext() });
        }, [IS_BROWSER]);

        return (
            <AudioSamplerDispatchContext.Provider value={dispatch}>
                <AudioSamplerStateContext.Provider value={state}>
                    {children}
                </AudioSamplerStateContext.Provider>
            </AudioSamplerDispatchContext.Provider >
        );
    };
}