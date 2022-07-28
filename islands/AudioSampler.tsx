/** @jsx h */
import { createContext, h } from "preact";
import { useContext, useReducer } from "preact/hooks";
import { tw } from "@twind";

export default function AudioSampler({ dbName, version }: { dbName: string, version: number; }) {
    const AudioSamplerContext = wrapper({ dbName, version });

    return (
        <AudioSamplerContext>
            <TestButton />
        </AudioSamplerContext>
    );
}

function useTestButton() {
    const { dispatch, state } = useAudioSamplerContext();

    return { dispatch, state };
}

function TestButton() {
    const { dispatch, state } = useTestButton();

    return (
        <button onClick={() => console.log(state.dbName, state.version)}>
            Test
        </button>
    );
}

type AudioSamplerAction = | { type: "test"; payload: AudioSamplerState; };

type AudioSamplerDispatch = (action: AudioSamplerAction) => void;

type AudioSamplerState = {
    dbName: string;
    version: number;
};

const AudioSamplerDispatchContext = createContext<AudioSamplerDispatch>(() => { });

const AudioSamplerStateContext = createContext<AudioSamplerState | undefined>(undefined);

const audioSamplerReducer = (state: AudioSamplerState, action: AudioSamplerAction) => {
    switch (action.type) {
        case "test":
            console.log("test");
            return state;
        default:
            return state;
    }
};

function useAudioSamplerContext() {
    const dispatch = useContext(AudioSamplerDispatchContext);
    const state = useContext(AudioSamplerStateContext);
    if (!state)
        throw new Error("useAudioSamplerContext must be used within a AudioSamplerContext");

    return { dispatch, state };
}

function wrapper({ dbName, version }: { dbName: string, version: number; }) {
    return function ({ children }: { children: h.JSX.Element; }) {
        const [state, dispatch] = useReducer(audioSamplerReducer, { dbName, version });
        return (
            <AudioSamplerStateContext.Provider value={state}>
                <AudioSamplerDispatchContext.Provider value={dispatch}>
                    {children}
                </AudioSamplerDispatchContext.Provider >
            </AudioSamplerStateContext.Provider>
        );
    };
}