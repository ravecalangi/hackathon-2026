import { sendToChatbot, userMessageImg } from './chatbot.js';


const fileInput = document.getElementById("file-input");
const preview = document.getElementById("preview");

const fileName = document.getElementById("file-name");
const sendBtn = document.getElementById("send-btn");
let previewContainer = document.querySelector(".file-preview-wrapper-container");



let selectedFile = null;


fileInput.addEventListener("click", () => {
  console.log("[DEBUG] change event FIRED. Selected file:", fileInput.files[0]?.name || "NONE");
  fileInput.value = "";

});

fileInput.addEventListener("change", () => {
  console.log("[DEBUG] change event FIRED. Selected file:", fileInput.files[0]?.name || "NONE");
  previewContainer.style.display = "flex";

  selectedFile = fileInput.files[0];
  if (!selectedFile) return;

  fileName.textContent = selectedFile.name;
  
  if (selectedFile.type.startsWith("image/")) {
    preview.src = URL.createObjectURL(selectedFile);
  } else {
    preview.src = "../../img/pdf.jpg";
  }
});

sendBtn.addEventListener("click", async () => {

  if (!selectedFile) {
    return;
  }

  const introBox = document.querySelector(".conversation-box");

  if (introBox) {
      introBox.remove();
  }

  previewContainer.style.display = "none";

  if (!selectedFile) {
    return;
  }

  const mainContainer = document.querySelector(".main-conversation");

  if (mainContainer) {
    if (selectedFile.type.startsWith("image/")) {
      // images already handled by userMessageImg() later
    } else {
      const userDiv = document.createElement("div");
      userDiv.classList.add("user");

      const p = document.createElement("p");
      p.innerHTML = `📄 Sent file: <strong>${selectedFile.name}</strong><br>` +
                    `<small>Size: ${(selectedFile.size / 1024).toFixed(1)} KB</small>`;

      userDiv.appendChild(p);
      mainContainer.appendChild(userDiv);

      mainContainer.scrollTop = mainContainer.scrollHeight;
    }
  }

  const reader = new FileReader();

  if (selectedFile.type.startsWith("image/")) {

      const imageUrl = URL.createObjectURL(selectedFile);
      userMessageImg(imageUrl);

      let loadingMessage = null;

      if (mainContainer) {
          const messageDiv = document.createElement('div');
          messageDiv.classList.add("chatbot");

          const p = document.createElement('p');
          p.classList.add("chatbot-message");
          p.textContent = "Reading image...";

          messageDiv.appendChild(p);
          mainContainer.appendChild(messageDiv);
          mainContainer.scrollTop = mainContainer.scrollHeight;

          loadingMessage = p;
      }

      reader.onload = async () => {
          try {
              const text = await runOCR(reader.result);

              if (loadingMessage) {
                  loadingMessage.textContent = "Processing with AI...";
                  await sendToChatbot(text, loadingMessage);
              } else {
                  await sendToChatbot(text);
              }

          } catch (err) {
              console.error("OCR failed:", err);
              if (loadingMessage) {
                  loadingMessage.textContent = "Error reading image: " + err.message;
              }
          }

      };

      reader.readAsDataURL(selectedFile);
  } 
  else if (selectedFile.type === "application/pdf") {

    reader.onload = async () => {
      const typedarray = new Uint8Array(reader.result);
      const pdf = await pdfjsLib.getDocument(typedarray).promise;

      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(" ") + "\n\n";
      }
      sendToChatbot(text);

    };
    reader.readAsArrayBuffer(selectedFile);

  } else if (selectedFile.name.endsWith(".docx")) {
    reader.onload = async () => {
      const arrayBuffer = reader.result;
      const result = await mammoth.extractRawText({ arrayBuffer });
      sendToChatbot(result.value);

    };
    reader.readAsArrayBuffer(selectedFile);

  } else if (selectedFile.type === "text/plain") {
    reader.onload = () => {
      sendToChatbot(reader.result);
    };
    reader.readAsText(selectedFile);

  } else {
    alert("Unsupported file type!");
  }

  selectedFile = null;
  fileInput.value = null;
  preview.src = "";
  fileName.textContent = "";

});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && selectedFile) {
    e.preventDefault();
    sendBtn.click();
  }
});

async function runOCR(base64Image) {
  const worker = await Tesseract.createWorker();
  await worker.loadLanguage('eng');
  await worker.initialize('eng');
  await worker.setParameters({
    tessedit_char_whitelist:
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?()'\"-:/ ",
    preserve_interword_spaces: "1"
  });

  const { data } = await worker.recognize(base64Image);
  await worker.terminate();

  return data.text.replace(/\n+/g, "\n").replace(/[ ]{2,}/g, " ").trim();
}