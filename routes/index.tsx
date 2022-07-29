/** @jsx h */
import { h } from "preact";
import { tw } from "@twind";
import AudioSampler from "../islands/AudioSampler.tsx";

export default function Home() {
    return (
        <main>
            <h1>Audio Sampler Project!</h1>
            <p>This demo project uses Deno's new web framework <a href="https://fresh.deno.dev/">Fresh</a></p>
            <AudioSampler dbName={"audio_sampler"} version={1} />
        </main>
    );
}
