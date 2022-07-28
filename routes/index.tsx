/** @jsx h */
import { h } from "preact";
import { tw } from "@twind";
import AudioSampler from "../islands/AudioSampler.tsx";

export default function Home() {
    return (
        <div>
            <h1>Audio Sampler Project!</h1>
            <p>This is a demo project using Deno's new web framework Fresh</p>
            <AudioSampler dbName={"audio_sampler"} version={1} />
        </div>
    );
}