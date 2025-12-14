import { Request, Response, NextFunction } from "express";
import supabaseService from "@/services/supabaseService";
import { AppError } from "@/types";

class AuthController {
  /**
   * Login user
   * POST /api/auth/login
   */
  public async login(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new AppError("Email and password are required", 400);
      }

      const { data, error } = await supabaseService
        .getClient()
        .auth.signInWithPassword({
          email,
          password,
        });

      if (error) {
        throw new AppError(error.message, 401);
      }

      res.status(200).json({
        success: true,
        token: data.session?.access_token,
        user: {
          id: data.user?.id,
          email: data.user?.email,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Register new user
   * POST /api/auth/register
   */
  public async register(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new AppError("Email and password are required", 400);
      }

      const { data, error } = await supabaseService.getClient().auth.signUp({
        email,
        password,
      });

      if (error) {
        throw new AppError(error.message, 400);
      }

      // If email confirmation is enabled, session might be null
      const token = data.session?.access_token;

      res.status(201).json({
        success: true,
        message: !token
          ? "Registration successful. Please confirm your email."
          : "Registration successful.",
        token,
        user: {
          id: data.user?.id,
          email: data.user?.email,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new AuthController();
