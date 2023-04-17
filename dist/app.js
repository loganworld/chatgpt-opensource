"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const gpt4all_1 = require("./gpt4all");
const main = async () => {
    console.log("start")
    var start = new Date();
    // Instantiate GPT4All with default or custom settings
    // const gpt4all = new GPT4All('gpt4all-lora-unfiltered-quantized', false); // Default is 'gpt4all-lora-quantized' model
    const gpt4all = new gpt4all_1.GPT4All(); // Default is 'gpt4all-lora-quantized' model
    // Initialize and download missing files
    await gpt4all.init();
    // Open the connection with the model
    await gpt4all.open();
    // Generate a response using a prompt
    var end = new Date();
    console.log("period", (end - start) / 1000)
    var start = new Date();
    const prompt = 'Tell me about how Open Access to AI is going to help humanity.';
    const response = await gpt4all.prompt(prompt);
    var end = new Date();
    console.log(`Prompt: ${prompt}`);
    console.log(`Response: ${response}`);
    console.log("period", (end - start) / 1000)
    const prompt2 = 'Explain to a five year old why AI is nothing to be afraid of.';
    const response2 = await gpt4all.prompt(prompt2);
    console.log(`Prompt: ${prompt2}`);
    console.log(`Response: ${response2}`);
    // Close the connection when you're done
    gpt4all.close();
};

const getTime = async (cb) => {
    var start = new Date();
    await cb();
    var end = new Date();
    console.log("period", (end - start) / 1000)
}
getTime(main).catch(console.error);
//# sourceMappingURL=app.js.map