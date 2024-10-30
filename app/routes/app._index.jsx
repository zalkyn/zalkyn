import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Collapsible,
  FormLayout,
  InlineStack,
  Layout,
  LegacyCard,
  Page,
  Popover,
  Text,
  TextField,
} from "@shopify/polaris";
import { DeleteIcon, ViewIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";
import { useAppBridge, Modal, TitleBar } from "@shopify/app-bridge-react";
import {
  useActionData,
  useLoaderData,
  useRouteError,
  useSubmit,
} from "@remix-run/react";
import { useEffect, useState } from "react";
import prisma from "../db.server";
import { metafieldSet } from "../components/metafields/metafieldSet";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  // create shop admin url
  const adminUrl = `admin.shopify.com/store/${session.shop.replace(".myshopify.com", "")}`;

  let products = [];

  try {
    products = await prisma.product.findMany();
  } catch (error) {
    console.error("error: ", error);
  }

  const settingsResponse = await prisma.settings.findMany();
  const settings = settingsResponse[0] || {};

  return json({
    products: products,
    settings: settings,
    title: "Settings",
    adminUrl: adminUrl,
  });
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const method = request.method;
  const formData = await request.formData();
  const data = Object.fromEntries(formData);
  const submitType = data.submitType;

  if (method === "POST" && submitType === "product-add") {
    const product = JSON.parse(data.selectedProduct);
    try {
      await prisma.product.upsert({
        where: { productId: product.id },
        update: {
          title: product.title,
          handle: product.handle,
          updatedAt: new Date(),
        },
        create: {
          productId: product.id,
          title: product.title,
          handle: product.handle,
        },
      });
    } catch (error) {
      console.error("error: ", error);
    }
  }

  if (method === "DELETE" && submitType === "product-remove") {
    const productId = data.productId;
    try {
      await prisma.product.delete({
        where: { productId: productId },
      });
    } catch (error) {
      console.error("error: ", error);
    }
  }

  if (method === "PUT" && submitType === "products-update") {
    const products = JSON.parse(data.products);
    try {
      await prisma.$transaction(
        products.map((product) =>
          prisma.product.upsert({
            where: { productId: product.productId },
            update: {
              price: product.price,
              lengthMin: product.lengthMin,
              lengthMax: product.lengthMax,
              widthMin: product.widthMin,
              widthMax: product.widthMax,
              status: product.status,
              updatedAt: new Date(),
            },
            create: {
              productId: product.productId,
              title: product.title,
              price: product.price,
              lengthMin: product.lengthMin,
              lengthMax: product.lengthMax,
              widthMin: product.widthMin,
              widthMax: product.widthMax,
            },
          }),
        ),
      );
    } catch (error) {
      console.error("error: ", error);
    }
  }

  if (method === "PUT" && submitType === "app-activate") {
    const appActivated = data.appActivated === "true";
    try {
      await prisma.settings.upsert({
        where: { shop: session.shop },
        update: {
          appActivated: appActivated,
          updatedAt: new Date(),
        },
        create: {
          shop: session.shop,
          appActivated: appActivated,
        },
      });
    } catch (error) {
      console.error("error: ", error);
    }
  }

  setTimeout(() => {
    metafieldSet(admin, session);
  }, 100);

  return json({
    method: method,
    submitType: submitType,
    title: "Settings",
  });
};

export default function AppSettings() {
  const shopify = useAppBridge();
  const submit = useSubmit();
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const [showResourcePicker, setShowResourcePicker] = useState(false);
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState({});
  const [productIds, setProductIds] = useState([]);
  const [collapsibles, setCollapsibles] = useState([]);
  const [selectedRemoveProduct, setSelectedRemoveProduct] = useState(null);
  const [disabledRemoveButton, setDisabledRemoveButton] = useState(false);
  const [disabledAddButton, setDisabledAddButton] = useState(false);
  const [disabledUpdateButton, setDisabledUpdateButton] = useState(false);
  const [adminUrl, setAdminUrl] = useState("");
  const [appActivatedBtnDisabled, setAppActivatedBtnDisabled] = useState(false);

  useEffect(() => {
    if (loaderData) {
      console.log("loaderData: ", loaderData);
      if (loaderData.products) {
        setProducts(loaderData.products);
        setProductIds(loaderData.products.map((product) => product.productId));
        setCollapsibles(
          loaderData.products.map((product, index) => {
            return {
              id: product.productId,
              open: index === 0 ? true : false,
            };
          }),
        );
      }
      if (loaderData.settings) {
        setSettings(loaderData.settings);
      }
      if (loaderData.adminUrl) {
        console.log("adminUrl: ", loaderData.adminUrl);
        setAdminUrl(loaderData.adminUrl);
      }
    }
  }, [loaderData]);

  const handleSelectProduct = async () => {
    setShowResourcePicker(true);
  };

  useEffect(() => {
    if (actionData) {
      if (actionData?.submitType === "product-add") {
        shopify.toast.show("New Product Successfully Added", {
          duration: 5000,
          type: "success",
        });
        setDisabledAddButton(false);
      } else if (actionData?.submitType === "product-remove") {
        shopify.toast.show("Product Successfully Removed", {
          duration: 5000,
          type: "success",
        });
        setDisabledRemoveButton(false);
        shopify.modal.hide("delete-modal");
      } else if (actionData?.submitType === "products-update") {
        shopify.toast.show("Products Successfully Updated", {
          duration: 5000,
          type: "success",
        });
        setDisabledUpdateButton(false);
      } else if (actionData?.submitType === "app-activate") {
        let activate = settings.appActivated;
        shopify.toast.show(
          `App Successfully ${activate ? "Activated" : "Inactivated"}`,
          {
            duration: 5000,
            type: "success",
          },
        );
        setAppActivatedBtnDisabled(false);
      }
    }
  }, [actionData]);

  useEffect(() => {
    if (showResourcePicker) {
      productResourcePicker();
    }
  }, [showResourcePicker]);

  const productResourcePicker = async () => {
    const selected = await shopify.resourcePicker({
      actions: "select",
      type: "product",
      multiple: false,
      filter: {
        variants: false,
        draft: false,
        archived: false,
      },
    });

    if (selected) {
      const product = selected.selection[0];

      if (productIds.includes(product.id)) {
        shopify.toast.show(`Product ${product.title} already exists`, {
          duration: 5000,
          type: "error",
        });
        setShowResourcePicker(false);
        return;
      }

      setDisabledAddButton(true);

      const formData = new FormData();
      formData.append("selectedProduct", JSON.stringify(product));
      formData.append("submitType", "product-add");
      submit(formData, { method: "POST" });

      setShowResourcePicker(false);
    } else {
      setShowResourcePicker(false);
    }
  };

  const handleCollapsible = (collapsible) => {
    setCollapsibles(
      collapsibles.map((item) =>
        item.id === collapsible.id ? { ...item, open: !item.open } : item,
      ),
    );
  };

  const handleRemoveModal = (product) => {
    shopify.modal.show("delete-modal");
    setSelectedRemoveProduct(product);
  };

  const handleRemoveProduct = async () => {
    setDisabledRemoveButton(true);
    const formData = new FormData();
    formData.append("productId", selectedRemoveProduct.productId);
    formData.append("submitType", "product-remove");
    submit(formData, { method: "DELETE" });
  };

  const handleProductInput = (value, field, product) => {
    const index = products.findIndex(
      (item) => item.productId === product.productId,
    );
    const updatedProducts = [...products];
    updatedProducts[index][field] = value;
    console.log("updatedProducts: ", updatedProducts);
    setProducts(updatedProducts);
  };

  const handleUpdateProducts = async () => {
    setDisabledUpdateButton(true);
    const formData = new FormData();
    formData.append("products", JSON.stringify(products));
    formData.append("submitType", "products-update");
    submit(formData, { method: "PUT" });
  };

  const handleAppActivate = () => {
    setAppActivatedBtnDisabled(true);
    setSettings({ ...settings, appActivated: !settings.appActivated });

    const formData = new FormData();
    formData.append("appActivated", !settings.appActivated);
    formData.append("submitType", "app-activate");
    submit(formData, { method: "PUT" });
  };

  return (
    <Page
      title="Ostersjosten Custom App"
      primaryAction={{
        content: "Add New Product",
        onAction: () => handleSelectProduct(),
        loading: disabledAddButton,
      }}
      secondaryActions={[
        {
          content: "Save & Update",
          onAction: () => handleUpdateProducts(),
          loading: disabledUpdateButton,
          disabled: products.length === 0,
        },
      ]}
    >
      <Layout>
        <Layout.Section>
          <LegacyCard>
            <LegacyCard.Section>
              <InlineStack align="space-between" blockAlign="center" gap={300}>
                <Text as="h4" variant="headingMd">
                  Your app is currently
                </Text>
                <ButtonGroup variant="segmented">
                  <Button
                    variant={settings.appActivated ? "primary" : "secondary"}
                    disabled={appActivatedBtnDisabled}
                    onClick={handleAppActivate}
                    loading={appActivatedBtnDisabled && settings.appActivated}
                  >
                    Active
                  </Button>
                  <Button
                    variant={settings.appActivated ? "secondary" : "primary"}
                    disabled={appActivatedBtnDisabled}
                    onClick={handleAppActivate}
                    loading={appActivatedBtnDisabled && !settings.appActivated}
                  >
                    Inactive
                  </Button>
                </ButtonGroup>
              </InlineStack>
            </LegacyCard.Section>
          </LegacyCard>
        </Layout.Section>
        <Layout.Section>
          {products?.map((product, index) => {
            const collapsible = collapsibles[index];
            return (
              <LegacyCard key={index}>
                <LegacyCard.Section>
                  <InlineStack align="space-between" blockAlign="center">
                    <Button
                      variant="monochromePlain"
                      onClick={() => handleCollapsible(collapsible)}
                      disclosure={collapsible.open ? "down" : "up"}
                    >
                      <InlineStack align="start" blockAlign="center" gap={300}>
                        <Text
                          as="h4"
                          variant="headingMd"
                          onClick={() => alert("ok")}
                        >
                          {product.title}
                        </Text>
                        <Badge status="success">
                          {collapsible.open ? "hide" : "show"}
                        </Badge>
                      </InlineStack>
                    </Button>
                    <ButtonGroup>
                      <ButtonGroup variant="segmented">
                        <Button
                          size="micro"
                          variant={product.status ? "primary" : "secondary"}
                          onClick={() =>
                            handleProductInput(
                              !product.status,
                              "status",
                              product,
                            )
                          }
                        >
                          Active
                        </Button>
                        <Button
                          size="micro"
                          variant={product.status ? "secondary" : "primary"}
                          onClick={() =>
                            handleProductInput(
                              !product.status,
                              "status",
                              product,
                            )
                          }
                        >
                          Inactive
                        </Button>
                      </ButtonGroup>
                      <ButtonGroup variant="segmented">
                        <Button
                          size="micro"
                          icon={ViewIcon}
                          url={`//${adminUrl}/products/${product.productId.replace("gid://shopify/Product/", "")}`}
                          target="_blank"
                        ></Button>
                        <Button
                          size="micro"
                          icon={DeleteIcon}
                          onClick={() => handleRemoveModal(product)}
                          disabled={disabledRemoveButton}
                        ></Button>
                      </ButtonGroup>
                    </ButtonGroup>
                  </InlineStack>
                  <Collapsible
                    open={collapsible.open}
                    id={collapsible.id}
                    key={collapsible.id}
                    transition={{
                      duration: "100ms",
                      timingFunction: "ease-in-out",
                    }}
                    expandOnPrint
                  >
                    <Box paddingBlock={200} />
                    <FormLayout>
                      <FormLayout.Group>
                        <TextField
                          label="text"
                          type="number"
                          labelHidden={true}
                          prefix="Price per square metter: "
                          suffix="kr"
                          value={
                            product.price == null
                              ? 0
                              : parseFloat(product.price)
                          }
                          onChange={(value) =>
                            handleProductInput(value, "price", product)
                          }
                        />
                        <TextField
                          label="Title"
                          labelHidden={true}
                          prefix="Title: "
                          value={product.title}
                          disabled={true}
                          readOnly={true}
                        />
                      </FormLayout.Group>
                      <FormLayout.Group>
                        <TextField
                          label="Option Name"
                          labelHidden={true}
                          prefix="Option Name: "
                          value={product.lengthOption}
                          disabled={false}
                          type="text"
                          onChange={(value) =>
                            handleProductInput(value, "lengthOption", product)
                          }
                          helpText="Must be same as variant option name"
                        />
                        <TextField
                          label="Length Min"
                          type="number"
                          min={1}
                          labelHidden={true}
                          prefix="Length Min: "
                          suffix="mm"
                          value={
                            product.lengthMin == null
                              ? 0
                              : parseInt(product.lengthMin)
                          }
                          onChange={(value) =>
                            handleProductInput(value, "lengthMin", product)
                          }
                        />
                        <TextField
                          label="Length Max"
                          type="number"
                          min={1}
                          labelHidden={true}
                          prefix="Length Max: "
                          suffix="mm"
                          value={
                            product.lengthMax == null
                              ? 0
                              : parseInt(product.lengthMax)
                          }
                          onChange={(value) =>
                            handleProductInput(value, "lengthMax", product)
                          }
                        />
                      </FormLayout.Group>
                      <FormLayout.Group>
                        <TextField
                          label="Option Name"
                          labelHidden={true}
                          prefix="Option Name: "
                          value={product.widthOption}
                          disabled={false}
                          type="text"
                          onChange={(value) =>
                            handleProductInput(value, "widthOption", product)
                          }
                          helpText="Must be same as variant option name"
                        />
                        <TextField
                          label="Width Min"
                          type="number"
                          min={1}
                          labelHidden={true}
                          prefix="Width Min: "
                          suffix="mm"
                          value={
                            product.widthMin == null
                              ? 0
                              : parseInt(product.widthMin)
                          }
                          onChange={(value) =>
                            handleProductInput(value, "widthMin", product)
                          }
                        />
                        <TextField
                          label="Width Max"
                          type="number"
                          min={1}
                          labelHidden={true}
                          prefix="Width Max: "
                          suffix="mm"
                          value={
                            product.widthMax == null
                              ? 0
                              : parseInt(product.widthMax)
                          }
                          onChange={(value) =>
                            handleProductInput(value, "widthMax", product)
                          }
                        />
                      </FormLayout.Group>
                    </FormLayout>
                  </Collapsible>
                </LegacyCard.Section>
              </LegacyCard>
            );
          })}
        </Layout.Section>

        {products.length > 0 && (
          <Layout.Section>
            <InlineStack align="end" blockAlign="center" gap={300}>
              <ButtonGroup>
                <Button
                  onClick={handleUpdateProducts}
                  loading={disabledUpdateButton}
                  variant="primary"
                >
                  Save & Update
                </Button>
              </ButtonGroup>
            </InlineStack>
            <Box paddingBlock={400} />
          </Layout.Section>
        )}

        <Modal id="delete-modal">
          <Box paddingInline={200} paddingBlock={400}>
            <Text>
              Are you sure you want to remove{" "}
              <strong>{selectedRemoveProduct?.title}</strong>?
            </Text>
          </Box>
          <TitleBar title={`${selectedRemoveProduct?.title}`} />
          <Box padding={400}>
            <InlineStack align="end" blockAlign="center" gap={300}>
              <ButtonGroup>
                <Button
                  disabled={disabledRemoveButton}
                  onClick={() => shopify.modal.hide("delete-modal")}
                  variant="primary"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRemoveProduct}
                  variant="primary"
                  tone="critical"
                  loading={disabledRemoveButton}
                  icon={DeleteIcon}
                >
                  remove
                </Button>
              </ButtonGroup>
            </InlineStack>
          </Box>
        </Modal>
        <Box paddingBlock={400} />
      </Layout>
    </Page>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <Page title="Error">
      <Layout>
        <Layout.Section>
          <p>There was an error: {error.message}</p>
        </Layout.Section>
      </Layout>
    </Page>
  );
}


