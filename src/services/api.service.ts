import { AxiosRequestConfig, AxiosStatic } from 'axios';
import { ResponseCodes, Routes } from '../helpers/constants.helper';
import {
  ApiResponse,
  ApplicationData,
  CommonSuccess,
  FullUserData,
  UploadedApplicatioData,
  UserResponseData,
} from '../interfaces/api';
import configManager from '../managers/config.manager';
import errorManager from '../managers/error.manager';
import FormData = require('form-data');

const axios: AxiosStatic = require('axios');

class ApiService {
  private readonly baseUrl = 'https://api.squarecloud.app/v1/public/';

  user(userId?: string): Promise<ApiResponse<UserResponseData> | undefined> {
    return this.fetch(`user${userId ? `/${userId}` : ''}`);
  }

  application(
    path: string,
    id: string,
    options?: AxiosRequestConfig | FormData | boolean
  ): Promise<ApiResponse | undefined> {
    if (options instanceof FormData) {
      options = {
        method: 'POST',
        data: options,
        headers: options.getHeaders(),
      };
    }

    if (typeof options === 'boolean') {
      options = {
        method: options ? 'POST' : undefined,
      };
    }

    return this.fetch(`${path}/${id}`, options);
  }

  async fetch(
    path: string,
    options: AxiosRequestConfig = {}
  ): Promise<ApiResponse | undefined> {
    if (!configManager.apiKey) {
      return;
    }

    options.headers = {
      ...(options.headers || {}),
      authorization: configManager.apiKey,
    };

    const res = await axios(`${this.baseUrl}${path}`, options).catch((err) =>
      errorManager.handleError(err)
    );

    return res?.data;
  }

  async upload(
    file: Buffer
  ): Promise<CommonSuccess<UploadedApplicatioData> | undefined> {
    const formData = new FormData();
    formData.append('file', file, {
      filename: 'app.zip',
      contentType: 'application/zip',
    });

    const data = (await this.fetch(Routes.Upload, {
      method: 'POST',
      data: formData,
      headers: formData.getHeaders(),
    })) as any;

    const { app, code } = data || {};

    return {
      success: code === ResponseCodes.Success,
      data: { id: app?.id, tag: app?.tag, ram: app?.ram },
    };
  }

  testKey(key: string) {
    return axios.get(`${this.baseUrl}user`, {
      headers: { authorization: key },
    });
  }

  hasAccess(
    value: UserResponseData
  ): value is { user: FullUserData; applications: ApplicationData[] } {
    return Boolean(value.user.email) && value.user.email !== 'Access denied';
  }
}

export default new ApiService();
