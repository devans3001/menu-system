// THE GRADE, production side.
//
// Guest and editor photos are finished at render time by the .photo-grade
// class in app/globals.css, so any photo an owner adds, at any time, on any
// deployment of this template, gets the same realistic finish automatically.
// Nothing is baked into the uploaded file and nothing needs re-uploading when
// the grade is tuned: change the preset once and every photo follows.
//
// For photos served from a client's own Cloudinary, the same finish can also
// be applied in the delivery URL itself. gradedPhotoUrl inserts the grade
// transformation into a Cloudinary URL and leaves every other URL untouched.
// e_improve lifts colour and contrast the way a food editor would, and the
// light sharpen restores the detail phone cameras soften.

export const CLOUDINARY_GRADE = "e_improve:100,e_sharpen:70,f_auto,q_auto";

export function gradedPhotoUrl(url: string): string {
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  if (url.includes(CLOUDINARY_GRADE)) return url;
  return url.replace("/upload/", "/upload/" + CLOUDINARY_GRADE + "/");
}
