"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";

import { getAgencyWorkspace } from "@/lib/agency-workspace";

const editableRoles = new Set(["owner", "admin", "manager", "agent"]);
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function optionalNumber(formData: FormData, name: string) {
  const value = text(formData, name);
  return value === "" ? null : Number(value);
}

function propertyPayload(formData: FormData) {
  return {
    title: text(formData, "title"),
    description: text(formData, "description") || null,
    property_type: text(formData, "property_type"),
    purpose: text(formData, "purpose"),
    district: text(formData, "district"),
    address: text(formData, "address") || null,
    price: Number(text(formData, "price")),
    currency: text(formData, "currency").toUpperCase() || "USD",
    bedrooms: optionalNumber(formData, "bedrooms"),
    bathrooms: optionalNumber(formData, "bathrooms"),
    area: optionalNumber(formData, "area"),
    furnished: formData.get("furnished") === "on",
    parking: formData.get("parking") === "on",
    security: formData.get("security") === "on",
    features: text(formData, "features").split(",").map((item) => item.trim()).filter(Boolean),
    video_url: text(formData, "video_url") || null,
    virtual_tour_url: text(formData, "virtual_tour_url") || null,
    status: text(formData, "status") || "available",
    available_from: text(formData, "available_from") || null,
  };
}

function validate(payload: ReturnType<typeof propertyPayload>) {
  if (!payload.title || !payload.property_type || !payload.purpose || !payload.district) return "Buuxi meelaha waajibka ah.";
  if (!Number.isFinite(payload.price) || payload.price < 0) return "Qiimaha property-gu sax ma aha.";
  if (payload.currency.length !== 3) return "Currency-gu waa inuu noqdaa saddex xaraf.";
  return null;
}

function imageFiles(formData: FormData) {
  return formData.getAll("images").filter((item): item is File => item instanceof File && item.size > 0);
}

function validateImages(files: File[]) {
  if (files.length > 8) return "Ugu badnaan 8 sawir geli.";
  if (files.some((file) => !imageTypes.has(file.type))) return "Sawirradu waa inay noqdaan JPG, PNG ama WebP.";
  if (files.some((file) => file.size > 5 * 1024 * 1024)) return "Sawir kasta waa inuu ka yaraadaa 5 MB.";
  return null;
}

async function uploadImages(supabase: Awaited<ReturnType<typeof getAgencyWorkspace>>["supabase"], agencyId: string, propertyId: string, files: File[]) {
  const urls: string[] = [];
  const paths: string[] = [];
  for (const file of files) {
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${agencyId}/${propertyId}/${randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("property-images").upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      if (paths.length) await supabase.storage.from("property-images").remove(paths);
      throw error;
    }
    paths.push(path);
    urls.push(supabase.storage.from("property-images").getPublicUrl(path).data.publicUrl);
  }
  return { urls, paths };
}

export async function createProperty(formData: FormData) {
  const { supabase, membership, agency } = await getAgencyWorkspace();
  if (!editableRoles.has(membership.role)) redirect("/properties?error=Ma lihid oggolaanshaha property cusub.");
  const payload = propertyPayload(formData);
  const files = imageFiles(formData);
  const errorMessage = validate(payload) || validateImages(files);
  if (errorMessage) redirect(`/properties/new?error=${encodeURIComponent(errorMessage)}`);

  const propertyId = randomUUID();
  const { error } = await supabase.from("properties").insert({ id: propertyId, agency_id: agency.id, ...payload });
  if (error) redirect("/properties/new?error=Property-ga lama kaydin. Hubi xogta.");

  let uploadedPaths: string[] = [];
  try {
    const { urls, paths } = await uploadImages(supabase, agency.id, propertyId, files);
    uploadedPaths = paths;
    if (urls.length) {
      const { error: updateError } = await supabase.from("properties").update({ image_urls: urls }).eq("id", propertyId).eq("agency_id", agency.id);
      if (updateError) throw updateError;
    }
  } catch {
    if (uploadedPaths.length) await supabase.storage.from("property-images").remove(uploadedPaths);
    await supabase.from("properties").delete().eq("id", propertyId).eq("agency_id", agency.id);
    redirect("/properties/new?error=Sawirrada lama kaydin; property-ga dib u isku day.");
  }
  redirect(`/properties/${propertyId}?message=Property-ga waa la abuuray.`);
}

export async function updateProperty(formData: FormData) {
  const { supabase, membership, agency } = await getAgencyWorkspace();
  const propertyId = text(formData, "property_id");
  if (!editableRoles.has(membership.role)) redirect(`/properties/${propertyId}?error=Ma lihid oggolaanshaha edit-ka.`);
  const payload = propertyPayload(formData);
  const files = imageFiles(formData);
  const errorMessage = validate(payload) || validateImages(files);
  if (errorMessage) redirect(`/properties/${propertyId}/edit?error=${encodeURIComponent(errorMessage)}`);

  const { data: current } = await supabase.from("properties").select("image_urls").eq("id", propertyId).eq("agency_id", agency.id).maybeSingle();
  if (!current) redirect("/properties?error=Property-ga lama helin.");

  let newUrls: string[] = [];
  let newPaths: string[] = [];
  try {
    const uploaded = await uploadImages(supabase, agency.id, propertyId, files);
    newUrls = uploaded.urls;
    newPaths = uploaded.paths;
  } catch {
    redirect(`/properties/${propertyId}/edit?error=Sawirrada cusub lama kaydin.`);
  }
  const keepExisting = formData.get("remove_existing_images") !== "on";
  const imageUrls = [...(keepExisting && Array.isArray(current.image_urls) ? current.image_urls as string[] : []), ...newUrls];
  const { error } = await supabase.from("properties").update({ ...payload, image_urls: imageUrls }).eq("id", propertyId).eq("agency_id", agency.id);
  if (error) {
    if (newPaths.length) await supabase.storage.from("property-images").remove(newPaths);
    redirect(`/properties/${propertyId}/edit?error=Isbeddelka lama kaydin.`);
  }
  if (!keepExisting) {
    const { data: storedFiles } = await supabase.storage.from("property-images").list(`${agency.id}/${propertyId}`);
    const oldPaths = storedFiles?.map((file) => `${agency.id}/${propertyId}/${file.name}`).filter((path) => !newPaths.includes(path)) ?? [];
    if (oldPaths.length) await supabase.storage.from("property-images").remove(oldPaths);
  }
  redirect(`/properties/${propertyId}?message=Property-ga waa la cusboonaysiiyey.`);
}

export async function deleteProperty(formData: FormData) {
  const { supabase, membership, agency } = await getAgencyWorkspace();
  const propertyId = text(formData, "property_id");
  if (!["owner", "admin", "manager"].includes(membership.role)) redirect(`/properties/${propertyId}?error=Ma lihid oggolaanshaha delete-ka.`);
  const { error } = await supabase.from("properties").delete().eq("id", propertyId).eq("agency_id", agency.id);
  if (error) redirect(`/properties/${propertyId}?error=Property-ga lama tirtiri karin.`);
  const { data: files } = await supabase.storage.from("property-images").list(`${agency.id}/${propertyId}`);
  if (files?.length) await supabase.storage.from("property-images").remove(files.map((file) => `${agency.id}/${propertyId}/${file.name}`));
  redirect("/properties?message=Property-ga waa la tirtiray.");
}
