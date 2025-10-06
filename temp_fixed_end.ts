        error: "Failed to fetch dashboard statistics",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get all bundles for dashboard
   * GET /api/dashboard/bundles
   */