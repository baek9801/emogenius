import "@/styles/globals.css";

function MyApp({ Component, pageProps }) {
  return (
    <div
      className="min-h-screen bg-fixed bg-center bg-cover flex items-center justify-center"
      style={{ backgroundImage: "url('/movie_theater.png')" }}
    >
      <div className="bg-gray-900 bg-opacity-80 p-5 rounded-lg shadow-lg w-full max-w-3xl text-center">
        <div className="flex justify-center py-1 mb-3 rounded-lg">
          <div className="text-yellow-300 font-bold text-5xl">Emogenius</div>
        </div>
        <div className="bg-gray-100 bg-opacity-90 rounded-2xl min-h-screen justify-center p-5 my-2">
          <Component {...pageProps} />
        </div>
      </div>
    </div>
  );
}

export default MyApp;
