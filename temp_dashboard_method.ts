  /**
   * Get dashboard statistics
   * GET /api/dashboard/stats
   */
  async getDashboardStats(req: Request, res: Response): Promise<void> {
    try {
      console.log("=== DASHBOARD STATS - START ===");

      // Get total bundles count
      console.log("Step 1: Fetching total bundles count");
      const bundlesResult = await this.supabaseService.query("updates", {
        select: "*",
        count: "exact"
      });
      
      console.log("Bundles result:", bundlesResult);
      const totalBundles = bundlesResult.count || 0;
      console.log("Bundles count:", totalBundles);

      // Get active devices count (unique device_ids)
      console.log("Step 2: Fetching active devices");
      const devicesResult = await this.supabaseService.query("device_channels", {
        select: "device_id"
      });
      
      console.log("Devices result:", devicesResult);
      const activeDevices = devicesResult.data
        ? new Set(devicesResult.data.map((d: any) => d.device_id)).size
        : 0;

      // Get active channels count (unique channels)
      console.log("Step 3: Fetching active channels");
      const channelsResult = await this.supabaseService.query("updates", {
        select: "channel"
      });
      
      console.log("Channels result:", channelsResult);
      const activeChannels = channelsResult.data
        ? new Set(channelsResult.data.map((c: any) => c.channel)).size
        : 0;

      // Get total downloads (downloaded stats)
      console.log("Step 4: Fetching total downloads");
      const downloadsResult = await this.supabaseService.query("update_stats", {
        select: "*",
        count: "exact",
        eq: { status: "downloaded" }
      });
      
      console.log("Downloads result:", downloadsResult);
      const totalDownloads = downloadsResult.count || 0;

      const stats: DashboardStatsResponse = {
        totalBundles,
        activeDevices,
        activeChannels,
        totalDownloads,
      };

      console.log("=== DASHBOARD STATS - SUCCESS ===", stats);
      res.json(stats);
    } catch (error) {
      console.error("=== DASHBOARD STATS - ERROR ===", error);
      logger.error(
        `Dashboard stats fetch failed - ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      res.status(500).json({
        error: "Failed to fetch dashboard statistics",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }