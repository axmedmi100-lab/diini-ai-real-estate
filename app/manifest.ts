import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DIINI AI Real Estate",
    short_name: "DIINI AI",
    description: "AI real estate sales, reception and agency management workspace",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f5f7f9",
    theme_color: "#08111f",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/diini-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/diini-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/diini-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

