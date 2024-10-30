import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-07";
import prisma from "./db.server";


const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October24,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  hooks: {
    async afterAuth({ session, admin }) {
      const queryResponse = await admin.graphql(
        `#graphql
          query {
            shop: shop { 
              name,
              id 
            }
          }
        `,
      );

      const { data } = await queryResponse.json();
      const { shop } = data;

      try {
        await prisma.session.update({
          where: { shop: session.shop },
          data: {
            shopId: shop.id,
          },
        });

        await prisma.settings.upsert({
          where: { shop: session.shop },
          update: {
            shop: session.shop,
            appActivated: false,
            updatedAt: new Date(),
          },
          create: {
            shop: session.shop,
            appActivated: false,
            settings: {},
          },
        });
      } catch (error) {
        console.log("Error updating shopId", error);
      }

      console.log(
        `Authenticated for ---------------- ${shop.name} (${shop.id})`,
      );
    },
  },
  restResources,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.October24;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
