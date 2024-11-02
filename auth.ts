import NextAuth, { Session, DefaultSession } from "next-auth";
import GitHub from "next-auth/providers/github";
import { AUTHOR_BY_GITHUB_ID_QUERY } from "@/sanity/lib/queries";
import { client } from "@/sanity/lib/client";
import { writeClient } from "@/sanity/lib/write-client";

declare module "next-auth" {
  interface Session extends DefaultSession {
    id?: string;
  }

  interface Profile {
    id?: string | null | undefined;
    login: string;
    bio: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  callbacks: {
    async signIn({ user: { name, email, image }, profile }) {
      if (!profile) return false;
      const { id, login, bio } = profile;

      try {
        const authorId = id?.toString();
        console.log('Signing in with author ID:"', authorId);

        const existingUser = await client
          .withConfig({ useCdn: false })
          .fetch(AUTHOR_BY_GITHUB_ID_QUERY, {
            id: authorId,
          });

        console.log("Existing user check:", existingUser);

        if (!existingUser) {
          const newUser = await writeClient.create({
            _type: "author",
            _id: `author-${authorId}`,
            id: authorId,
            name,
            username: login,
            email,
            image,
            bio: bio || "",
          });

          console.log("New user created:", newUser);
        }

        return true;
      } catch (error) {
        console.error("Error in signIn callback:", error);
        return false;
      }
    },

    async jwt({ token, account, profile }) {
      if (account && profile) {
        const user = await client
          .withConfig({ useCdn: false })
          .fetch(AUTHOR_BY_GITHUB_ID_QUERY, {
            id: profile?.id?.toString(),
          });

        token.id = user?.id?.toString();
      }

      return token;
    },
    async session({ session, token }) {
      Object.assign(session, { id: token.id });
      return session;
    },
  },
});
