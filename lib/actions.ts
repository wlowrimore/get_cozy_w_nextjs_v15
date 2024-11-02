"use server";

import { auth } from "@/auth";
import { parseServerActionResponse } from "@/lib/utils";
import slugify from "slugify";
import { writeClient } from "@/sanity/lib/write-client";
import { client } from "@/sanity/lib/client";

export const createPitch = async (
  state: any,
  form: FormData,
  pitch: string
) => {
  const session = await auth();
  console.log("SESSION in actions", session);

  if (!session || !session?.id)
    return parseServerActionResponse({
      status: "ERROR",
      error: "Not signed in or invalid session",
    });

  const authorId = session.id.toString();
  const authorExists = await client
    .withConfig({ useCdn: false })
    .fetch(`*[_type == "author" && id == $id][0]`, {
      id: authorId,
    });

  console.log("Author check:", { authorId, authorExists });

  if (!authorExists) {
    return parseServerActionResponse({
      status: "ERROR",
      error: "Author not found in database",
    });
  }

  const { title, description, category, link } = Object.fromEntries(
    Array.from(form).filter(([key]) => key !== "pitch")
  );

  const slug = slugify(title as string, { lower: true, strict: true });

  try {
    const startup = {
      title,
      description,
      category,
      image: link,
      slug: {
        _type: "slug",
        current: slug,
      },
      author: {
        _type: "reference",
        _ref: `${authorExists._id}`,
      },
      pitch,
    };

    console.log("Creating startup with:", startup);

    const result = await writeClient.create({ _type: "startup", ...startup });

    return parseServerActionResponse({
      ...result,
      error: "",
      status: "SUCCESS",
    });
  } catch (error) {
    console.log("Error creating startup:", error);

    return parseServerActionResponse({
      status: "ERROR",
      error: JSON.stringify(error),
    });
  }
};
