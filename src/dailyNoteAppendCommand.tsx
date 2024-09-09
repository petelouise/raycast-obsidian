import {
  Action,
  ActionPanel,
  closeMainWindow,
  getFrontmostApplication,
  getPreferenceValues,
  List,
  open,
  popToRoot,
} from "@raycast/api";
import { useEffect, useState } from "react";
import AdvancedURIPluginNotInstalled from "./components/Notifications/AdvancedURIPluginNotInstalled";
import { NoVaultFoundMessage } from "./components/Notifications/NoVaultFoundMessage";
import { vaultsWithoutAdvancedURIToast } from "./components/Toasts";
import { clearCache } from "./utils/data/cache";
import { DailyNoteAppendPreferences } from "./utils/preferences";
import {
  applyTemplates,
  getObsidianTarget,
  ObsidianTargetType,
  useObsidianVaults,
  vaultPluginCheck,
} from "./utils/utils";

interface DailyNoteAppendArgs {
  text: string;
}

export default function DailyNoteAppend(props: { arguments: DailyNoteAppendArgs }) {
  const { vaults, ready } = useObsidianVaults();
  const { text } = props.arguments;
  const { appendTemplate, heading, vaultName, silent } = getPreferenceValues<DailyNoteAppendPreferences>();
  const [vaultsWithPlugin, setVaultsWithPlugin] = useState<Vault[]>([]);
  const [vaultsWithoutPlugin, setVaultsWithoutPlugin] = useState<Vault[]>([]);
  const [content, setContent] = useState("");

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initializeAndAppend() {
      if (!ready) return;

      const [withPlugin, withoutPlugin] = vaultPluginCheck(vaults, "obsidian-advanced-uri");
      setVaultsWithPlugin(withPlugin);
      setVaultsWithoutPlugin(withoutPlugin);

      const processedContent = await applyTemplates(text, appendTemplate);
      setContent(processedContent);

      if (withoutPlugin.length > 0) {
        vaultsWithoutAdvancedURIToast(withoutPlugin);
      }

      const selectedVault = vaultName && vaults.find((vault) => vault.name === vaultName);
      
      if (selectedVault || withPlugin.length === 1) {
        try {
          const previousApplication = await getFrontmostApplication();
          const vaultToUse = selectedVault || withPlugin[0];
          const target = getObsidianTarget({
            type: ObsidianTargetType.DailyNoteAppend,
            vault: vaultToUse,
            text: processedContent,
            heading: heading,
            silent: silent,
          });
          await open(target);
          clearCache();
          await popToRoot();
          await closeMainWindow();
          if (previousApplication.bundleId) {
            await open(previousApplication.bundleId);
          }
        } catch (error) {
          console.error("Error in DailyNoteAppend:", error);
        }
      }

      setIsLoading(false);
    }

    initializeAndAppend();
  }, [ready, vaults, text, appendTemplate, vaultName, heading, silent]);

  if (!ready || isLoading) {
    return <List isLoading={true} />;
  }

  if (vaults.length === 0) {
    return <NoVaultFoundMessage />;
  }

  if (vaultsWithPlugin.length === 0) {
    return <AdvancedURIPluginNotInstalled />;
  }

  if (vaultName && !vaultsWithPlugin.some((v) => v.name === vaultName)) {
    return <AdvancedURIPluginNotInstalled vaultName={vaultName} />;
  }

  // If there's only one vault or a selected vault, we don't need to show the list
  if (vaultName || vaultsWithPlugin.length === 1) {
    return <List isLoading={false} />;
  }

  // Otherwise let the user select a vault
  return (
    <List isLoading={isLoading}>
      {vaultsWithPlugin?.map((vault) => (
        <List.Item
          title={vault.name}
          key={vault.key}
          actions={
            <ActionPanel>
              <Action.Open
                title="Append to Daily Note"
                target={getObsidianTarget({
                  type: ObsidianTargetType.DailyNoteAppend,
                  vault: vault,
                  text: content,
                  heading: heading,
                })}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
