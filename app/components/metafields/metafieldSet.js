
export const metafieldSet = async (admin, session) => {
  try {
    const appUrl = process.env.SHOPIFY_APP_URL || "";
    console.log("appUrl----------: ", appUrl);
    const shopDataResponse = await admin.graphql(
      `#graphql
            query {
              shop {
                id
              }
            }
          `,
    );

    const shopData = await shopDataResponse.json();
    const shopId = shopData.data.shop.id;
    const productsData = await prisma.product.findMany({
      select: {
        productId: true,
        title: true,
        handle: true,
        price: true,
        lengthMin: true,
        lengthMax: true,
        lengthOption: true,
        widthMin: true,
        widthMax: true,
        widthOption: true,
      },
      where: {
        status: true,
      },
    });

    const settingsData = await prisma.settings.findMany({
      where: {
        shop: session.shop,
      },
      select: {
        shop: true,
        appActivated: true,
      },
    });

    const settings = settingsData[0];

    const metafieldData = {
      appName: "Articmaze",
      appUrl: appUrl,
      products: productsData,
      settings: settings,
    };

    const variables = {
      metafields: [
        {
          key: "settings",
          namespace: "articmaze",
          ownerId: shopId,
          type: "json",
          value: JSON.stringify(metafieldData),
        },
      ],
    };

    const response = await admin.graphql(
      `#graphql
      mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            key
            namespace
            value
            createdAt
            updatedAt
          }
          userErrors {
            field
            message
            code
          }
        }
      }`,
      {
        variables: variables,
      },
    );

    const data = await response.json();
  } catch (error) {
    console.error("error: ", error);
  }
};
