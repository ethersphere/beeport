"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function UploadPage() {
  const [fileName, setFileName] = useState("127.0.0.1");
  const [fileNumber, setFileNumber] = useState("12345");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
    }
  };

  const handleSubmit = () => {
    if (selectedFile) {
      console.log("Archivo seleccionado:", selectedFile.name);
      console.log("Número asociado:", fileNumber);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-white text-gray-800">
      <div className="w-full max-w-md space-y-8">
        <div className="flex items-center space-x-4">
          <Input
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            className="flex-grow border-2 border-gray-300 rounded-md p-2 text-gray-800"
            readOnly
          />
          <span className="text-2xl font-bold text-gray-800">:</span>
          <Input
            value={fileNumber}
            onChange={(e) => setFileNumber(e.target.value)}
            className="w-24 border-2 border-gray-300 rounded-md p-2 text-gray-800"
          />
        </div>

        <div className="flex justify-center mt-8">
          <Button
            onClick={handleFileUpload}
            className="bg-gray-200 text-gray-800 border-2 border-gray-400 rounded-md px-6 py-2 text-lg hover:bg-gray-300"
          >
            Upload
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {selectedFile && (
          <Button
            onClick={handleSubmit}
            className="mt-4 bg-blue-500 text-white border-2 border-blue-600 rounded-md px-6 py-2 text-lg w-full hover:bg-blue-600"
          >
            Upload File
          </Button>
        )}
      </div>
    </main>
  );
}
