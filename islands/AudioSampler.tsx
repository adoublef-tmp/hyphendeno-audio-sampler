/** @jsx h */
/** @jsxFrag Fragment */
import { createContext, h, Fragment } from "preact";
import { useContext, useEffect, useReducer, useState } from "preact/hooks";
import { tw } from "@twind";
import { IS_BROWSER } from "$fresh/runtime.ts";
import { openDB, DBSchema } from "idb/with-async-ittr";

export default function AudioSampler({ dbName, version }: AudioSamplerProps) {
    const AudioSamplerContext = audioSamplerContext({ dbName, version });
    return (
        <AudioSamplerContext>
            <div>
                <SampleLibrary />
                <DrumPad />
            </div>
        </AudioSamplerContext>
    );
}

function DrumPad({ length }: { length?: number; }) {
    const { state: { library } } = useAudioSamplerContext();
    if (!length) length = 4;
    return (
        <>
            {Array.from({ length }).map((_, i) => <SamplePad key={i} />)}
        </>
    );
}

type LibraryEntry = {
    name: string;
};

function useSampleLibrary() {
    const { dispatch, state: { dbName, version, library } } = useAudioSamplerContext();
    // const [library, setLibrary] = useState<string[]>([]);

    useEffect(() => {
        (async () => {
            if (IS_BROWSER) {
                const db = await dbConnection({ dbName, version });

                const tx = db.transaction("sample");

                for await (const cursor of tx.store) {
                    // libray should have file name and file svg path?
                    dispatch({ type: "uploadsample", payload: { name: cursor.value.name } });
                }

                await tx.done;
            }
        })();
    }, [IS_BROWSER]);

    return { library };
}

function SampleLibrary() {
    const { library } = useSampleLibrary();

    return (
        <>
            <h1>Sample Library</h1>
            {[...library].map(([name,]) => <SamplePreview key={name} name={name} />)}
        </>
    );
}

function SamplePreview({ name }: { name: string; }) {
    function selectSample(e: DragEvent) {
        console.log(`Selected sample: ${name}`);
        e.dataTransfer?.setData("text/plain", name);
    }

    return (
        <div onDragStart={selectSample} draggable class={tw`border(2 red solid) w-20`}>{name}</div>
    );
}


function useSamplePad(props: { name?: string; }) {
    const { dispatch, state: { dbName, version, audioCtx, library } } = useAudioSamplerContext();

    const [name, setName] = useState(props?.name ?? "audio");

    const playSample = async () => {
        const db = await dbConnection({ dbName, version });

        const tx = db.transaction("sample", "readwrite");
        const store = tx.objectStore("sample");

        const [sample] = await Promise.all([store.get(name), tx.done]);

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

        if (e.dataTransfer?.types.includes("text/plain")) {
            const name = e.dataTransfer.getData("text/plain");
            setName(name);
        }

        if (e.dataTransfer?.files) {
            // only one file at a time
            const file = e.dataTransfer?.files.item(0);

            if (file) {
                /** ADD TO DATABASE - `put` replace (&&) `add` rejects */
                const db = await dbConnection({ dbName, version });

                const tx = db.transaction("sample", "readwrite");
                const store = tx.objectStore("sample");

                const sample = { name: file.name.replace(/\.[^/.]+$/, ""), size: file.size, file: file };

                const [name] = await Promise.all([store.put(sample), tx.done]);

                setName(name);

                dispatch({ type: "uploadsample", payload: { name } });
            }
        }

        console.log("huh,", library);
    }

    return { playSample, uploadSample, sampleName: name };
}

function SamplePad(props: { name?: string; }) {
    const { playSample, uploadSample, sampleName } = useSamplePad(props);

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
    | { type: "audiocontext", payload: AudioContext; }
    | { type: "uploadsample", payload: LibraryEntry; };

type AudioSamplerDispatch = (action: AudioSamplerAction) => void;

type AudioSamplerState = {
    dbName: string;
    version: number;
    library: Map<string, LibraryEntry>;
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

function audioSamplerContext({ dbName, version }: { dbName: string, version: number; }) {
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
                case "uploadsample": {
                    const e: LibraryEntry = { name: action.payload.name, };
                    return { ...state, library: state.library.set(e.name, e) };
                }
                case "test":
                    console.log("this is a test");
                    return state;
                default:
                    return state;
            }
        }, { dbName, version, library: new Map() });

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