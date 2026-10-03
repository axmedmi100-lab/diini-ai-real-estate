import { AuthMessage } from "@/components/auth/auth-message";

type Property = Record<string, unknown>;

export function PropertyForm({ action, property, error }: { action: (formData: FormData) => Promise<void>; property?: Property; error?: string }) {
  const input = "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
  const checkbox = "h-4 w-4 rounded border-slate-300 text-emerald-600";
  const features = Array.isArray(property?.features) ? property.features.join(", ") : "";
  return (
    <form action={action} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <AuthMessage error={error} />
      {property?.id ? <input name="property_id" type="hidden" value={String(property.id)} /> : null}
      <div className="mt-2 grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Cinwaanka property-ga *<input className={input} defaultValue={String(property?.title ?? "")} name="title" required /></label>
        <label className="text-sm font-semibold text-slate-700">Nooca *<select className={input} defaultValue={String(property?.property_type ?? "apartment")} name="property_type"><option value="apartment">Apartment</option><option value="house">House</option><option value="villa">Villa</option><option value="office">Office</option><option value="shop">Shop</option><option value="land">Land</option><option value="commercial">Commercial</option><option value="other">Other</option></select></label>
        <label className="text-sm font-semibold text-slate-700">Ujeeddo *<select className={input} defaultValue={String(property?.purpose ?? "rent")} name="purpose"><option value="rent">Kiro</option><option value="sale">Iib</option></select></label>
        <label className="text-sm font-semibold text-slate-700">Degmada *<input className={input} defaultValue={String(property?.district ?? "")} name="district" required /></label>
        <label className="text-sm font-semibold text-slate-700">Cinwaanka faahfaahsan<input className={input} defaultValue={String(property?.address ?? "")} name="address" /></label>
        <label className="text-sm font-semibold text-slate-700">Qiimaha *<input className={input} defaultValue={String(property?.price ?? "")} min="0" name="price" required step="0.01" type="number" /></label>
        <label className="text-sm font-semibold text-slate-700">Currency<select className={input} defaultValue={String(property?.currency ?? "USD")} name="currency"><option value="USD">USD</option><option value="SOS">SOS</option><option value="KES">KES</option></select></label>
        <label className="text-sm font-semibold text-slate-700">Bedrooms<input className={input} defaultValue={String(property?.bedrooms ?? "")} min="0" name="bedrooms" type="number" /></label>
        <label className="text-sm font-semibold text-slate-700">Bathrooms<input className={input} defaultValue={String(property?.bathrooms ?? "")} min="0" name="bathrooms" type="number" /></label>
        <label className="text-sm font-semibold text-slate-700">Area (m²)<input className={input} defaultValue={String(property?.area ?? "")} min="0" name="area" step="0.01" type="number" /></label>
        <label className="text-sm font-semibold text-slate-700">Status<select className={input} defaultValue={String(property?.status ?? "available")} name="status"><option value="available">Available</option><option value="reserved">Reserved</option><option value="rented">Rented</option><option value="sold">Sold</option><option value="inactive">Inactive</option></select></label>
        <label className="text-sm font-semibold text-slate-700">Available from<input className={input} defaultValue={String(property?.available_from ?? "")} name="available_from" type="date" /></label>
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Features (comma ku kala saar)<input className={input} defaultValue={features} name="features" placeholder="Balcony, generator, water tank" /></label>
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Sharaxaad<textarea className={`${input} min-h-32 resize-y`} defaultValue={String(property?.description ?? "")} name="description" /></label>
        <label className="text-sm font-semibold text-slate-700">Video URL<input className={input} defaultValue={String(property?.video_url ?? "")} name="video_url" type="url" /></label>
        <label className="text-sm font-semibold text-slate-700">Virtual tour URL<input className={input} defaultValue={String(property?.virtual_tour_url ?? "")} name="virtual_tour_url" type="url" /></label>
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Sawirro (JPG, PNG, WebP; ugu badnaan 8)<input accept="image/jpeg,image/png,image/webp" className={input} multiple name="images" type="file" /></label>
      </div>
      <div className="mt-6 flex flex-wrap gap-5">{[["furnished", "Furnished"], ["parking", "Parking"], ["security", "Security"]].map(([name, label]) => <label className="flex items-center gap-2 text-sm font-semibold text-slate-700" key={name}><input className={checkbox} defaultChecked={Boolean(property?.[name])} name={name} type="checkbox" />{label}</label>)}</div>
      {property && Array.isArray(property.image_urls) && property.image_urls.length ? <label className="mt-5 flex items-center gap-2 text-sm font-semibold text-rose-700"><input className={checkbox} name="remove_existing_images" type="checkbox" />Ka saar dhammaan sawirradii hore</label> : null}
      <button className="mt-8 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800" type="submit">{property ? "Kaydi isbeddelka" : "Abuur property-ga"}</button>
    </form>
  );
}
