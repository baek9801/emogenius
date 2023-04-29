import { useState, useEffect, useRef } from "react";
import MagentaPlayer from "./newMagenta";
import { useRouter } from "next/router";

const Home = () => {
  const [waiting, loading, processing, generated] = [0, 1, 2, 3];
  const [processState, setProcessState] = useState(waiting);
  const [startLoading, setStartLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const [gotVideo, setGotVideo] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (thumbnailUrl && videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.preload = "auto";
      videoRef.current.addEventListener("canplay", () => {
        drawThumbnail();
        setGotVideo(true);
      });
    }
  }, [thumbnailUrl]);

  const drawThumbnail = () => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      ctx.drawImage(
        videoRef.current,
        0,
        0,
        canvasRef.current.width,
        canvasRef.current.height
      );
    }
  };

  const process = async () => {
    const formData = new FormData();

    formData.append("video", fileInputRef.current.files[0]);

    console.log(fileInputRef.current.files[0]);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("An error occurred during the file upload");
      } else {
        setProcessState(generated);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `output_${fileInputRef.current.files[0].name}`
      );
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (error) {
      console.error(error);
      alert("An error occurred during the file upload");
    }
  };

  useEffect(() => {
    if (processState === processing) {
      process();
    }
  }, [processState]);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!fileInputRef.current.files[0]) {
      alert("Please select a file to upload");
    }
    setProcessState(loading);
    setStartLoading(true);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (event) => {
    event.preventDefault();
    if (event.dataTransfer.files.length > 0) {
      fileInputRef.current.files = event.dataTransfer.files;
      setFileName(event.dataTransfer.files[0].name);
      setThumbnailUrl(URL.createObjectURL(event.dataTransfer.files[0]));
      setGotVideo(false);
    }
  };

  const handleFileChange = (event) => {
    if (event.target.files.length > 0) {
      setFileName(event.target.files[0].name);
      setThumbnailUrl(URL.createObjectURL(event.target.files[0]));
      setGotVideo(false);
    }
  };

  const handleClick = () => {
    fileInputRef.current.click();
  };

  const showState = () => {
    switch (processState) {
      case waiting:
        return <div>Select Your MP4 File</div>;
        break;
      case loading:
        return (
          <div className="flex justify-center">
            <div>Generating music sequence...</div>
            <div className="spinner" />
          </div>
        );
        break;
      case processing:
        return (
          <div className="flex justify-center">
            <div>Adding music to the video...</div>
            <div className="spinner" />
          </div>
        );
        break;
      case generated:
        return <div>Check your output file!</div>;
        break;
      default:
        return <div>something went wrong!</div>;
    }
  };

  return (
    <div className="flex-r">
      <MagentaPlayer
        setProcessState={setProcessState}
        startLoading={startLoading}
      />
      <div>
        <div className="text-3xl text-bold">{showState()}</div>
        <form className="m-3" onSubmit={handleFormSubmit}>
          <div
            className={
              "bg-gray-300 border-4 border-dashed border-gray-400 rounded-xl h-64 w-full flex items-center justify-center" +
              (processState === waiting
                ? " hover:border-black hover:bg-gray-400 cursor-pointer"
                : "")
            }
            onDragOver={processState === waiting ? handleDragOver : null}
            onDrop={processState === waiting ? handleDrop : null}
            onClick={processState === waiting ? handleClick : null}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="flex items-center">
              {thumbnailUrl && (
                <>
                  <canvas
                    ref={canvasRef}
                    className="h-56 w-auto mr-3 object-cover"
                  />
                  <video ref={videoRef} src={thumbnailUrl} className="hidden" />
                </>
              )}
              <span>
                {fileName ? fileName : "Drag & Drop your MP4 video here"}
              </span>
            </div>
          </div>
          <div className="w-full flex justify-center">
            {processState === waiting ? (
              gotVideo ? (
                <button
                  className={
                    "mt-3 w-96 bg-gradient-to-b from-red-600 to-red-900 text-white text-3xl p-4 border-4 border-gray-900 rounded-3xl hover:bg-gradient-to-b hover:from-gray-900 hover:to-gray-600 hover:text-yellow-300 "
                  }
                  type="submit"
                >
                  Upload and Process
                </button>
              ) : (
                <div
                  onClick={processState === waiting ? handleClick : null}
                  className="mt-3 w-96 bg-gradient-to-b from-gray-300 to-gray-400 text-white text-3xl p-4 border-4 border-gray-400 rounded-3xl hover:bg-gradient-to-b hover:from-gray-600 hover:to-gray-500 cursor-pointer"
                >
                  Select Video
                </div>
              )
            ) : (
              <button
                className="mt-3 w-96 bg-gradient-to-b from-red-600 to-red-900 text-white text-3xl p-4 border-4 border-gray-900 rounded-3xl hover:bg-gradient-to-b hover:from-gray-900 hover:to-gray-600 hover:text-yellow-300 "
                onClick={() => {
                  router.push("/").then(() => {
                    window.location.reload();
                  });
                }}
              >
                Select video again
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default Home;
