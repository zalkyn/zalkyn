import { Layout, Page } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import {
  json,
  useActionData,
  useLoaderData,
  useRouteError,
  useSubmit,
} from "@remix-run/react";

import { metafieldSet } from "../components/metafields/metafieldSet";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  return json({
    message: "Hello, World!",
  });
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  const sessionData = await prisma.session.findMany({
    where: { shop: session.shop },
  });

  const shopId = sessionData[0].shopId;
  const products = await prisma.product.findMany();

  const variables = {
    metafields: [
      {
        key: "settings",
        namespace: "articmaze",
        ownerId: shopId,
        type: "json",
        value: JSON.stringify(products),
      },
    ],
  };

  const data = await metafieldSet(admin, variables);

  return json({
    message: "Hello, World!",
    data: data,
  });
};

export default function AppTest() {
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();

  //   if (loaderData) console.log("Loader Data", loaderData);
  if (actionData) console.log("Action Data", actionData);

  const handlePrivateMetafields = async () => {
    const formData = new FormData();

    submit(formData, { method: "POST" });
  };

  return (
    <Page
      title="Test Page"
      primaryAction={{
        content: "Save",
        onAction: () => handlePrivateMetafields(),
      }}
    >
      <Layout>
        <Layout.Section>
          <p>Test Page</p>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const ErrorBoundary = () => {
  const error = useRouteError();
  return (
    <Page title="Error">
      <Layout>
        <Layout.Section>
          <p>{error.message}</p>
        </Layout.Section>
      </Layout>
    </Page>
  );
};
